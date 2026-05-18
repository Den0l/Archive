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
        private readonly SignInManager<ApplicationUser> signInManager;
        private readonly ITokenRepository tokenRepository;
        private readonly IBackgroundNotificationQueue backgroundNotificationQueue;
        private readonly IConfiguration configuration;
        private readonly ILogger<AuthController> logger;

        public AuthController(
            UserManager<ApplicationUser> userManager,
            SignInManager<ApplicationUser> signInManager,
            ITokenRepository tokenRepository,
            IBackgroundNotificationQueue backgroundNotificationQueue,
            IConfiguration configuration,
            ILogger<AuthController> logger)
        {
            this.userManager = userManager;
            this.signInManager = signInManager;
            this.tokenRepository = tokenRepository;
            this.backgroundNotificationQueue = backgroundNotificationQueue;
            this.configuration = configuration;
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

            var signInResult = await signInManager.CheckPasswordSignInAsync(
                user,
                loginRequest.Password,
                lockoutOnFailure: true);
            if (signInResult.IsLockedOut)
            {
                return BadRequest("Аккаунт временно заблокирован из-за нескольких неудачных попыток. Попробуйте позже.");
            }
            if (!signInResult.Succeeded)
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

            return Ok(response);
        }

        [AllowAnonymous]
        [HttpPost]
        [Route("ForgotPassword")]
        public async Task<IActionResult> ForgotPassword(
            [FromBody] ForgotPasswordRequest request)
        {
            const string genericReply =
                "Если указанный e-mail зарегистрирован, на него будет отправлена ссылка для сброса пароля.";

            var email = request.Email?.Trim();
            if (string.IsNullOrWhiteSpace(email))
            {
                return BadRequest("Укажите e-mail.");
            }

            var user = await userManager.FindByEmailAsync(email);
            if (user == null)
            {
                return Ok(genericReply);
            }

            var resetToken = await userManager.GeneratePasswordResetTokenAsync(user);
            var resetUrl = BuildPasswordResetUrl(email, resetToken);

            var nickname = user.Nickname;
            await backgroundNotificationQueue.QueueAsync(
                (notificationEmailService, cancellationToken) =>
                    notificationEmailService.SendPasswordResetAsync(
                        email,
                        nickname,
                        resetUrl));

            return Ok(genericReply);
        }

        [AllowAnonymous]
        [HttpPost]
        [Route("ResetPassword")]
        public async Task<IActionResult> ResetPassword(
            [FromBody] ResetPasswordRequest request)
        {
            var email = request.Email.Trim();
            var user = await userManager.FindByEmailAsync(email);
            if (user == null)
            {
                return BadRequest("Не удалось сбросить пароль.");
            }

            var token = request.Token.Replace(' ', '+');
            var resetResult = await userManager.ResetPasswordAsync(
                user,
                token,
                request.NewPassword);
            if (!resetResult.Succeeded)
            {
                return BadRequest("Не удалось сбросить пароль. Возможно, ссылка устарела.");
            }

            await userManager.UpdateSecurityStampAsync(user);
            return Ok("Пароль успешно изменён.");
        }

        private string BuildPasswordResetUrl(string email, string token)
        {
            var baseUrl = configuration["Frontend:BaseUrl"];
            if (string.IsNullOrWhiteSpace(baseUrl))
            {
                baseUrl = Environment.GetEnvironmentVariable("FRONTEND_BASE_URL");
            }

            baseUrl = NormalizeFrontendBaseUrl(baseUrl);

            var encodedEmail = Uri.EscapeDataString(email);
            var encodedToken = Uri.EscapeDataString(token);
            return $"{baseUrl}/auth/reset-password?email={encodedEmail}&token={encodedToken}";
        }

        private static string NormalizeFrontendBaseUrl(string? rawBaseUrl)
        {
            var candidate = string.IsNullOrWhiteSpace(rawBaseUrl)
                ? "http://localhost:3000"
                : rawBaseUrl.Trim();

            if (TryBuildAbsoluteHttpUrl(candidate, out var normalizedAbsolute))
            {
                return normalizedAbsolute;
            }

            var defaultScheme = candidate.StartsWith(
                                    "localhost",
                                    StringComparison.OrdinalIgnoreCase) ||
                                candidate.StartsWith(
                                    "127.0.0.1",
                                    StringComparison.OrdinalIgnoreCase)
                ? "http://"
                : "https://";

            var withScheme = $"{defaultScheme}{candidate.TrimStart('/')}";
            if (TryBuildAbsoluteHttpUrl(withScheme, out normalizedAbsolute))
            {
                return normalizedAbsolute;
            }

            return "http://localhost:3000";

            static bool TryBuildAbsoluteHttpUrl(string value, out string normalized)
            {
                normalized = string.Empty;
                if (!Uri.TryCreate(value, UriKind.Absolute, out var uri))
                {
                    return false;
                }

                if (!string.Equals(
                        uri.Scheme,
                        Uri.UriSchemeHttp,
                        StringComparison.OrdinalIgnoreCase) &&
                    !string.Equals(
                        uri.Scheme,
                        Uri.UriSchemeHttps,
                        StringComparison.OrdinalIgnoreCase))
                {
                    return false;
                }

                normalized = uri.OriginalString.TrimEnd('/');
                return true;
            }
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

            if (string.IsNullOrWhiteSpace(request.Token))
            {
                return BadRequest("Не указан токен подтверждения.");
            }

            if (string.IsNullOrWhiteSpace(request.NewEmail))
            {
                return BadRequest("Укажите новый e-mail.");
            }

            var newEmail = request.NewEmail.Trim();

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
