using AutoMapper;
using Infrastructure.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using WebApi.ApiDtos.Users;
using WebApi.Services;

namespace WebApi.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class UsersController : ControllerBase
    {
        private readonly UserManager<ApplicationUser> userManager;
        private readonly IMapper mapper;
        private readonly IEmailVerificationService emailVerificationService;
        private readonly IBackgroundNotificationQueue backgroundNotificationQueue;
        private readonly ILogger<UsersController> logger;

        public UsersController(
            UserManager<ApplicationUser> userManager,
            IMapper mapper,
            IEmailVerificationService emailVerificationService,
            IBackgroundNotificationQueue backgroundNotificationQueue,
            ILogger<UsersController> logger)
        {
            this.userManager = userManager;
            this.mapper = mapper;
            this.emailVerificationService = emailVerificationService;
            this.backgroundNotificationQueue = backgroundNotificationQueue;
            this.logger = logger;
        }

        [HttpGet("{id:guid}")]
        [AllowAnonymous]
        public async Task<IActionResult> GetById(Guid id)
        {
            var user = await userManager.FindByIdAsync(id.ToString());
            if (user == null)
                return NotFound();

            return Ok(CreatePublicUserDto(user));
        }

        [HttpGet("{id:guid}/detail")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetDetail(Guid id)
        {
            var user = await userManager.FindByIdAsync(id.ToString());
            if (user == null)
                return NotFound();

            var roles = await userManager.GetRolesAsync(user);
            var dto = mapper.Map<UserDetailDto>(user);
            dto.Roles = roles.ToList();
            return Ok(dto);
        }

        [HttpPost("{id:guid}/roles/admin")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> AddAdminRole(Guid id)
        {
            var user = await userManager.FindByIdAsync(id.ToString());
            if (user == null)
                return NotFound();

            var result = await userManager.AddToRoleAsync(user, "Admin");
            if (!result.Succeeded)
                return BadRequest(result.Errors);

            var roles = await userManager.GetRolesAsync(user);
            var dto = mapper.Map<UserDetailDto>(user);
            dto.Roles = roles.ToList();
            return Ok(dto);
        }

        [HttpDelete("{id:guid}/roles/admin")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> RemoveAdminRole(Guid id)
        {
            var user = await userManager.FindByIdAsync(id.ToString());
            if (user == null)
                return NotFound();

            var result = await userManager.RemoveFromRoleAsync(user, "Admin");
            if (!result.Succeeded)
                return BadRequest(result.Errors);

            var roles = await userManager.GetRolesAsync(user);
            var dto = mapper.Map<UserDetailDto>(user);
            dto.Roles = roles.ToList();
            return Ok(dto);
        }

        [HttpDelete("{id:guid}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var user = await userManager.FindByIdAsync(id.ToString());
            if (user == null)
                return NotFound();

            await userManager.DeleteAsync(user);
            return Ok(mapper.Map<UserDto>(user));
        }

        [HttpGet("GetAll")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetAll()
        {
            var users = await userManager.Users.ToListAsync();
            var dtos = new List<UserDetailDto>(users.Count);

            foreach (var user in users)
            {
                var roles = await userManager.GetRolesAsync(user);
                var dto = mapper.Map<UserDetailDto>(user);
                dto.Roles = roles.ToList();
                dtos.Add(dto);
            }

            return Ok(dtos);
        }

        [HttpGet("me/settings")]
        [Authorize]
        public async Task<IActionResult> GetMySettings()
        {
            var user = await GetCurrentUserAsync();
            if (user == null)
                return Unauthorized();

            return Ok(CreateUserSettingsDto(user));
        }

        [HttpPut("me/settings/notifications")]
        [Authorize]
        public async Task<IActionResult> UpdateNotificationPreferences(
            [FromBody] UpdateNotificationPreferencesRequest request)
        {
            var user = await GetCurrentUserAsync();
            if (user == null)
                return Unauthorized();

            user.NotifyEmailOnNewMessage = request.NotifyEmailOnNewMessage;
            user.NotifyEmailOnSellerOrder = request.NotifyEmailOnSellerOrder;
            user.NotifyEmailOnFollowedSellerListing =
                request.NotifyEmailOnFollowedSellerListing;
            user.NotifyEmailOnLogin = request.NotifyEmailOnLogin;

            var result = await userManager.UpdateAsync(user);
            if (!result.Succeeded)
                return BadRequest("Не удалось сохранить настройки уведомлений.");

            return Ok(CreateUserSettingsDto(user));
        }

        [HttpPost("me/settings/email/verify-request")]
        [Authorize]
        public async Task<IActionResult> RequestCurrentEmailVerificationCode()
        {
            var user = await GetCurrentUserAsync();
            if (user == null)
                return Unauthorized();

            if (string.IsNullOrWhiteSpace(user.Email))
            {
                return BadRequest("Текущая почта отсутствует.");
            }

            if (user.EmailConfirmed)
            {
                return BadRequest("Текущая почта уже подтверждена.");
            }

            var code = emailVerificationService.IssueCode(
                user.Id,
                user.Email,
                "verify-current");

            try
            {
                var email = user.Email;
                var nickname = user.Nickname;
                await backgroundNotificationQueue.QueueAsync(
                    (emailService, cancellationToken) =>
                        emailService.SendEmailVerificationCodeAsync(
                            email,
                            nickname,
                            code));
            }
            catch (Exception exception)
            {
                logger.LogWarning(
                    exception,
                    "Failed to send email verification code to user {UserId}.",
                    user.Id);

                return StatusCode(
                    StatusCodes.Status500InternalServerError,
                    "Не удалось отправить код подтверждения текущей почты.");
            }

            return Ok();
        }

        [HttpPost("me/settings/email/verify-confirm")]
        [Authorize]
        public async Task<IActionResult> ConfirmCurrentEmailByCode(
            [FromBody] ConfirmEmailCodeRequest request)
        {
            var user = await GetCurrentUserAsync();
            if (user == null)
                return Unauthorized();

            if (string.IsNullOrWhiteSpace(user.Email))
            {
                return BadRequest("Текущая почта отсутствует.");
            }

            if (user.EmailConfirmed)
            {
                return Ok(CreateUserSettingsDto(user));
            }

            var isCodeValid = emailVerificationService.TryConsumeCode(
                user.Id,
                user.Email,
                "verify-current",
                request.Code.Trim());
            if (!isCodeValid)
            {
                return BadRequest("Неверный код подтверждения.");
            }

            user.EmailConfirmed = true;
            var updateResult = await userManager.UpdateAsync(user);
            if (!updateResult.Succeeded)
            {
                return BadRequest("Не удалось подтвердить текущую почту.");
            }

            return Ok(CreateUserSettingsDto(user));
        }

        [HttpPost("me/settings/email/change-request")]
        [Authorize]
        public async Task<IActionResult> RequestEmailChange(
            [FromBody] RequestEmailChangeRequest request)
        {
            var user = await GetCurrentUserAsync();
            if (user == null)
                return Unauthorized();

            var newEmail = request.NewEmail.Trim();
            if (string.IsNullOrWhiteSpace(newEmail))
            {
                return BadRequest("Укажите новый e-mail.");
            }

            if (userManager.NormalizeEmail(user.Email) == userManager.NormalizeEmail(newEmail))
            {
                return BadRequest("Новый e-mail совпадает с текущим.");
            }

            var existingUserWithEmail = await userManager.FindByEmailAsync(newEmail);
            if (existingUserWithEmail != null && existingUserWithEmail.Id != user.Id)
            {
                return BadRequest("Почта уже используется.");
            }

            user.PendingEmail = newEmail;
            user.PendingEmailRequestedAt = DateTime.Now;

            var updateResult = await userManager.UpdateAsync(user);
            if (!updateResult.Succeeded)
            {
                return BadRequest("Не удалось подготовить смену e-mail.");
            }

            var code = emailVerificationService.IssueCode(
                user.Id,
                newEmail,
                "change-email");

            try
            {
                var nickname = user.Nickname;
                await backgroundNotificationQueue.QueueAsync(
                    (emailService, cancellationToken) =>
                        emailService.SendEmailChangeCodeAsync(
                            newEmail,
                            nickname,
                            newEmail,
                            code));
            }
            catch (Exception exception)
            {
                logger.LogWarning(
                    exception,
                    "Failed to send email change code to user {UserId}.",
                    user.Id);

                emailVerificationService.RevokeCode(user.Id);
                user.PendingEmail = null;
                user.PendingEmailRequestedAt = null;
                await userManager.UpdateAsync(user);

                return StatusCode(
                    StatusCodes.Status500InternalServerError,
                    "Не удалось отправить код подтверждения новой почты.");
            }

            return Ok(CreateUserSettingsDto(user));
        }

        [HttpPost("me/settings/email/change-confirm")]
        [Authorize]
        public async Task<IActionResult> ConfirmEmailChangeByCode(
            [FromBody] ConfirmEmailCodeRequest request)
        {
            var user = await GetCurrentUserAsync();
            if (user == null)
                return Unauthorized();

            var pendingEmail = user.PendingEmail?.Trim();
            if (string.IsNullOrWhiteSpace(pendingEmail))
            {
                return BadRequest("Запрос на смену e-mail не найден.");
            }

            var isCodeValid = emailVerificationService.TryConsumeCode(
                user.Id,
                pendingEmail,
                "change-email",
                request.Code.Trim());
            if (!isCodeValid)
            {
                return BadRequest("Неверный код подтверждения.");
            }

            var setEmailResult = await userManager.SetEmailAsync(user, pendingEmail);
            if (!setEmailResult.Succeeded)
            {
                return BadRequest("Не удалось изменить e-mail.");
            }

            var setUserNameResult = await userManager.SetUserNameAsync(user, pendingEmail);
            if (!setUserNameResult.Succeeded)
            {
                return BadRequest("Не удалось обновить логин пользователя.");
            }

            user.EmailConfirmed = true;
            user.PendingEmail = null;
            user.PendingEmailRequestedAt = null;

            var updateResult = await userManager.UpdateAsync(user);
            if (!updateResult.Succeeded)
            {
                return BadRequest("Не удалось завершить смену e-mail.");
            }

            await userManager.UpdateSecurityStampAsync(user);
            return Ok(CreateUserSettingsDto(user));
        }

        [HttpPost("me/settings/password")]
        [Authorize]
        public async Task<IActionResult> ChangePassword(
            [FromBody] ChangePasswordRequest request)
        {
            var user = await GetCurrentUserAsync();
            if (user == null)
                return Unauthorized();

            if (request.NewPassword != request.ConfirmNewPassword)
            {
                return BadRequest("Новые пароли не совпадают.");
            }

            var result = await userManager.ChangePasswordAsync(
                user,
                request.CurrentPassword,
                request.NewPassword);
            if (!result.Succeeded)
            {
                if (result.Errors.Any(error => error.Code == "PasswordMismatch"))
                {
                    return BadRequest("Неверный текущий пароль.");
                }

                return BadRequest("Не удалось сменить пароль.");
            }

            if (user.MustChangePassword)
            {
                user.MustChangePassword = false;
                await userManager.UpdateAsync(user);
            }

            await userManager.UpdateSecurityStampAsync(user);
            return Ok("Пароль успешно изменён.");
        }

        private async Task<ApplicationUser?> GetCurrentUserAsync()
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrWhiteSpace(userId))
            {
                return null;
            }

            return await userManager.FindByIdAsync(userId);
        }

        private static UserSettingsDto CreateUserSettingsDto(ApplicationUser user)
        {
            return new UserSettingsDto
            {
                Email = user.Email ?? string.Empty,
                PendingEmail = user.PendingEmail,
                EmailConfirmed = user.EmailConfirmed,
                Notifications = new NotificationPreferencesDto
                {
                    NotifyEmailOnNewMessage = user.NotifyEmailOnNewMessage,
                    NotifyEmailOnSellerOrder = user.NotifyEmailOnSellerOrder,
                    NotifyEmailOnFollowedSellerListing =
                        user.NotifyEmailOnFollowedSellerListing,
                    NotifyEmailOnLogin = user.NotifyEmailOnLogin
                }
            };
        }

        private UserDto CreatePublicUserDto(ApplicationUser user)
        {
            var dto = mapper.Map<UserDto>(user);
            dto.Email = string.Empty;

            if (CanViewUserEmail(user.Id))
            {
                dto.Email = user.Email ?? string.Empty;
            }

            return dto;
        }

        private bool CanViewUserEmail(Guid userId)
        {
            if (User.Identity?.IsAuthenticated != true)
            {
                return false;
            }

            var currentUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return string.Equals(
                    currentUserId,
                    userId.ToString(),
                    StringComparison.OrdinalIgnoreCase)
                || User.IsInRole("Admin");
        }

    }
}
