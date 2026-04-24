using System.Security.Cryptography;
using Infrastructure.Identity;
using Infrastructure.Identity.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApi.ApiDtos.Auth;
using WebApi.Services;

namespace WebApi.Controllers
{
    /// <summary>
    /// Handles user authentication and registration,
    /// allows users to register, login, and handles token creation.
    /// </summary>
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly UserManager<ApplicationUser> userManager;
        private readonly ITokenRepository tokenRepository;
        private readonly IBackgroundNotificationQueue backgroundNotificationQueue;
        private readonly ILogger<AuthController> logger;

        /// <summary>
        /// Constructor to initialize AuthController with necessary dependencies.
        /// </summary>
        /// <param name="userManager">ASP.NET Core Identity UserManager to manage user accounts.</param>
        /// <param name="tokenRepository">Repository to handle JWT token generation.</param>
        public AuthController(
            UserManager<ApplicationUser> userManager,
            ITokenRepository tokenRepository,
            IBackgroundNotificationQueue backgroundNotificationQueue,
            ILogger<AuthController> logger)
        {
            this.userManager = userManager;
            this.tokenRepository = tokenRepository;
            this.backgroundNotificationQueue = backgroundNotificationQueue;
            this.logger = logger;
        }

        /// <summary>
        /// Registers a new user with provided credentials. If it is the first user in the database, he gets admin role.
        /// Subsequent registered people get user role.
        /// </summary>
        /// <param name="registerRequest">Request object containing username, password</param>
        /// <returns>Success message or error message if registration fails.</returns>
        [HttpPost]
        [Route("Register")]
        public async Task<IActionResult> Register([FromBody] RegisterRequest registerRequest)
        {
            var emailExists = await userManager.FindByEmailAsync(registerRequest.Username);
            if (emailExists != null)
            {
                return BadRequest("Почта уже используется");
            }

            var normalizedNickname = userManager.NormalizeName(registerRequest.Nickname?.Trim());
            if (!string.IsNullOrWhiteSpace(normalizedNickname))
            {
                var nicknameExists = await userManager.Users.AnyAsync(
                    user => user.NormalizedNickname == normalizedNickname);
                if (nicknameExists)
                {
                    return BadRequest("Никнейм уже используется");
                }
            }

            var user = new ApplicationUser
            {
                UserName = registerRequest.Username,
                Nickname = registerRequest.Nickname,
                Email = registerRequest.Username,
                NormalizedNickname = normalizedNickname,
                NotifyEmailOnNewMessage = true,
                NotifyEmailOnSellerOrder = true,
                NotifyEmailOnFollowedSellerListing = true,
                NotifyEmailOnLogin = true
            };
            var identityResult = await userManager.CreateAsync(user, registerRequest.Password);
            if (!identityResult.Succeeded)
            {
                return BadRequest("Something went wrong");
            }

            if (userManager.Users.Count() == 1)
            {
                identityResult = await userManager.AddToRolesAsync(
                    user,
                    new List<string> { "Admin" });
            }

            identityResult = await userManager.AddToRolesAsync(user, new List<string> { "User" });
            if (!identityResult.Succeeded)
            {
                return BadRequest("Something went wrong, couldnt asign roles to the user manager");
            }

            return Ok("User was registered, please log in");
        }

        /// <summary>
        /// Authenticates a user and returns a JWT token if login is successful.
        /// </summary>
        /// <param name="loginRequest">Request object containing the user's credentials.</param>
        /// <returns>A JWT token or error message if login fails.</returns>
        [HttpPost]
        [Route("Login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest loginRequest)
        {
            var user = await userManager.FindByEmailAsync(loginRequest.Username);
            if (user == null)
            {
                return BadRequest("Invalid credentials");
            }

            var passwordValid = await userManager.CheckPasswordAsync(user, loginRequest.Password);
            if (!passwordValid)
            {
                return BadRequest("Invalid credentials");
            }

            var loginTime = DateTime.Now;
            user.LastLoggedIn = loginTime;
            var updateLoginResult = await userManager.UpdateAsync(user);
            if (!updateLoginResult.Succeeded)
            {
                logger.LogWarning(
                    "Failed to persist last login time for user {UserId}.",
                    user.Id);
            }

            if (user.NotifyEmailOnLogin && !string.IsNullOrWhiteSpace(user.Email))
            {
                var email = user.Email;
                var nickname = user.Nickname;
                var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
                var userAgent = Request.Headers.UserAgent.ToString();

                await backgroundNotificationQueue.QueueAsync(
                    (notificationEmailService, cancellationToken) =>
                        notificationEmailService.SendLoginNotificationAsync(
                            email,
                            nickname,
                            loginTime,
                            ipAddress,
                            userAgent));
            }

            var roles = await userManager.GetRolesAsync(user);
            if (roles == null)
            {
                return BadRequest("No roles for the user");
            }

            var jwtToken = tokenRepository.CreateJWTToken(user, roles.ToList());
            var response = new LoginResponse
            {
                JwtToken = jwtToken,
                MustChangePassword = user.MustChangePassword
            };

            if (user.MustChangePassword)
            {
                user.MustChangePassword = false;
                await userManager.UpdateAsync(user);
            }

            return Ok(response);
        }

        [AllowAnonymous]
        [HttpPost]
        [Route("ForgotPassword")]
        public async Task<IActionResult> ForgotPassword(
            [FromBody] ForgotPasswordRequest request)
        {
            var email = request.Email?.Trim();
            if (string.IsNullOrWhiteSpace(email))
            {
                return BadRequest("Укажите e-mail.");
            }

            var user = await userManager.FindByEmailAsync(email);
            if (user == null)
            {
                return Ok("Если указанный e-mail зарегистрирован, на него будет отправлен новый пароль.");
            }

            var newPassword = GenerateRandomPassword(12);

            var resetToken = await userManager.GeneratePasswordResetTokenAsync(user);
            var resetResult = await userManager.ResetPasswordAsync(user, resetToken, newPassword);
            if (!resetResult.Succeeded)
            {
                return BadRequest("Не удалось сбросить пароль.");
            }

            user.MustChangePassword = true;
            await userManager.UpdateAsync(user);

            var nickname = user.Nickname;
            await backgroundNotificationQueue.QueueAsync(
                (notificationEmailService, cancellationToken) =>
                    notificationEmailService.SendPasswordResetAsync(
                        email,
                        nickname,
                        newPassword));

            return Ok("Если указанный e-mail зарегистрирован, на него будет отправлен новый пароль.");
        }

        private static string GenerateRandomPassword(int length)
        {
            const string upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
            const string lower = "abcdefghijklmnopqrstuvwxyz";
            const string digits = "0123456789";
            const string special = "!@#$%&*";
            const string all = upper + lower + digits + special;

            var password = new char[length];
            password[0] = upper[RandomNumberGenerator.GetInt32(upper.Length)];
            password[1] = lower[RandomNumberGenerator.GetInt32(lower.Length)];
            password[2] = digits[RandomNumberGenerator.GetInt32(digits.Length)];
            password[3] = special[RandomNumberGenerator.GetInt32(special.Length)];

            for (int i = 4; i < length; i++)
            {
                password[i] = all[RandomNumberGenerator.GetInt32(all.Length)];
            }

            // Shuffle
            for (int i = password.Length - 1; i > 0; i--)
            {
                int j = RandomNumberGenerator.GetInt32(i + 1);
                (password[i], password[j]) = (password[j], password[i]);
            }

            return new string(password);
        }

        [AllowAnonymous]
        [HttpPost]
        [Route("confirm-email-change")]
        public async Task<IActionResult> ConfirmEmailChange(
            [FromBody] ConfirmEmailChangeRequest request)
        {
            if (request.UserId == Guid.Empty)
            {
                return BadRequest("Некорректный идентификатор пользователя.");
            }

            var newEmail = request.NewEmail.Trim();
            if (string.IsNullOrWhiteSpace(newEmail))
            {
                return BadRequest("Укажите новый e-mail.");
            }

            var user = await userManager.FindByIdAsync(request.UserId.ToString());
            if (user == null)
            {
                return NotFound("Пользователь не найден.");
            }

            var pendingEmail = user.PendingEmail?.Trim();
            if (string.IsNullOrWhiteSpace(pendingEmail) ||
                userManager.NormalizeEmail(pendingEmail) != userManager.NormalizeEmail(newEmail))
            {
                return BadRequest("Запрос на смену e-mail не найден.");
            }

            var token = request.Token.Replace(' ', '+');
            var changeResult = await userManager.ChangeEmailAsync(user, newEmail, token);
            if (!changeResult.Succeeded)
            {
                return BadRequest("Не удалось подтвердить новую почту.");
            }

            user.UserName = newEmail;
            user.PendingEmail = null;
            user.PendingEmailRequestedAt = null;

            var updateResult = await userManager.UpdateAsync(user);
            if (!updateResult.Succeeded)
            {
                return BadRequest("Не удалось завершить смену e-mail.");
            }

            await userManager.UpdateSecurityStampAsync(user);

            return Ok("Новый e-mail успешно подтверждён.");
        }
    }
}
