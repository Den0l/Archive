using System.Globalization;
using System.Net;
using System.Text.RegularExpressions;
using MailKit.Security;
using Microsoft.Extensions.Configuration;
using MimeKit;

namespace WebApi.Services
{
    public class SmtpNotificationEmailService : INotificationEmailService
    {
        private readonly IConfiguration configuration;

        public SmtpNotificationEmailService(IConfiguration configuration)
        {
            this.configuration = configuration;
        }

        public Task SendEmailChangeConfirmationAsync(
            Guid userId,
            string toEmail,
            string? toName,
            string newEmail,
            string token)
        {
            var confirmationUrl = BuildUrl(
                $"/auth/confirm-email-change?userId={userId}&email={Uri.EscapeDataString(newEmail)}&token={Uri.EscapeDataString(token)}");
            var safeName = GetSafeName(toName);
            var subject = $"{GetOptions().BrandName}: подтвердите новый e-mail";
            var body = BuildShell(
                "Подтверждение новой почты",
                $@"
                    <p>Здравствуйте, {safeName}.</p>
                    <p>Вы запросили смену адреса электронной почты на <strong>{WebUtility.HtmlEncode(newEmail)}</strong>.</p>
                    <p>Чтобы завершить изменение, перейдите по ссылке ниже:</p>
                    <p><a href=""{confirmationUrl}"" style=""color:#000099;"">{confirmationUrl}</a></p>
                    <p>Если это были не вы, просто проигнорируйте это письмо.</p>");

            return SendEmailAsync(toEmail, toName, subject, body);
        }

        public Task SendEmailVerificationCodeAsync(
            string toEmail,
            string? toName,
            string code)
        {
            var subject = $"{GetOptions().BrandName}: код подтверждения почты";
            var body = BuildShell(
                "Подтверждение почты",
                $@"
                    <p>Здравствуйте, {GetSafeName(toName)}.</p>
                    <p>Введите этот код для подтверждения текущей почты:</p>
                    <p style=""font-size:28px;font-weight:700;letter-spacing:4px;margin:12px 0;color:#000099;background:#ffffcc;display:inline-block;padding:8px 16px;border:2px solid #ff9900;"">{WebUtility.HtmlEncode(code)}</p>
                    <p>Если это были не вы, просто проигнорируйте письмо.</p>");

            return SendEmailAsync(toEmail, toName, subject, body);
        }

        public Task SendEmailChangeCodeAsync(
            string toEmail,
            string? toName,
            string newEmail,
            string code)
        {
            var subject = $"{GetOptions().BrandName}: код для смены e-mail";
            var body = BuildShell(
                "Смена e-mail",
                $@"
                    <p>Здравствуйте, {GetSafeName(toName)}.</p>
                    <p>Вы запросили смену e-mail на <strong>{WebUtility.HtmlEncode(newEmail)}</strong>.</p>
                    <p>Введите этот код в настройках профиля:</p>
                    <p style=""font-size:28px;font-weight:700;letter-spacing:4px;margin:12px 0;color:#000099;background:#ffffcc;display:inline-block;padding:8px 16px;border:2px solid #ff9900;"">{WebUtility.HtmlEncode(code)}</p>
                    <p>Если это были не вы, просто проигнорируйте письмо.</p>");

            return SendEmailAsync(toEmail, toName, subject, body);
        }

        public Task SendNewMessageNotificationAsync(
            string toEmail,
            string? toName,
            string senderName,
            string messagePreview,
            Guid conversationId)
        {
            var conversationUrl = BuildUrl($"/inbox/{conversationId}");
            var subject = $"{GetOptions().BrandName}: новое сообщение";
            var body = BuildShell(
                "Новое сообщение",
                $@"
                    <p>Здравствуйте, {GetSafeName(toName)}.</p>
                    <p>Пользователь <strong>{WebUtility.HtmlEncode(senderName)}</strong> отправил вам новое сообщение.</p>
                    <blockquote style=""margin:16px 0;padding:12px 16px;border-left:4px solid #ff9900;background:#ffffcc;"">{WebUtility.HtmlEncode(TrimPreview(messagePreview))}</blockquote>
                    <p>Открыть переписку: <a href=""{conversationUrl}"" style=""color:#000099;"">{conversationUrl}</a></p>",
                toEmail);

            return SendEmailAsync(toEmail, toName, subject, body, isBulk: true);
        }

        public Task SendSellerOrderNotificationAsync(
            string toEmail,
            string? toName,
            string buyerName,
            string listingTitle)
        {
            var subject = $"{GetOptions().BrandName}: у вас новый заказ";
            var body = BuildShell(
                "Новый заказ",
                $@"
                    <p>Здравствуйте, {GetSafeName(toName)}.</p>
                    <p>Покупатель <strong>{WebUtility.HtmlEncode(buyerName)}</strong> оформил заказ на ваше объявление <strong>{WebUtility.HtmlEncode(listingTitle)}</strong>.</p>
                    <p>Проверьте диалоги и профиль продавца в сервисе, чтобы продолжить общение с покупателем.</p>",
                toEmail);

            return SendEmailAsync(toEmail, toName, subject, body, isBulk: true);
        }

        public Task SendFollowedSellerListingNotificationAsync(
            string toEmail,
            string? toName,
            string sellerName,
            string listingTitle,
            Guid listingId)
        {
            var listingUrl = BuildUrl($"/listing/{listingId}");
            var subject = $"{GetOptions().BrandName}: новое объявление у продавца";
            var body = BuildShell(
                "Новое объявление у продавца",
                $@"
                    <p>Здравствуйте, {GetSafeName(toName)}.</p>
                    <p>Продавец <strong>{WebUtility.HtmlEncode(sellerName)}</strong>, на которого вы подписаны, опубликовал новое объявление:</p>
                    <p><strong>{WebUtility.HtmlEncode(listingTitle)}</strong></p>
                    <p>Открыть объявление: <a href=""{listingUrl}"" style=""color:#000099;"">{listingUrl}</a></p>",
                toEmail);

            return SendEmailAsync(toEmail, toName, subject, body, isBulk: true);
        }

        public Task SendListingRemovedByAdminNotificationAsync(
            string toEmail,
            string? toName,
            string listingTitle,
            Guid listingId,
            string? adminName)
        {
            var safeAdminName = string.IsNullOrWhiteSpace(adminName)
                ? "Администратор"
                : WebUtility.HtmlEncode(adminName);
            var subject = $"{GetOptions().BrandName}: объявление удалено администратором";
            var body = BuildShell(
                "Объявление удалено администратором",
                $@"
                    <p>Здравствуйте, {GetSafeName(toName)}.</p>
                    <p>Ваше объявление <strong>{WebUtility.HtmlEncode(listingTitle)}</strong> (ID: <strong>{listingId}</strong>) было удалено администратором <strong>{safeAdminName}</strong>.</p>
                    <p>Если вы считаете, что это произошло по ошибке, обратитесь в поддержку сервиса.</p>",
                toEmail);

            return SendEmailAsync(toEmail, toName, subject, body, isBulk: true);
        }

        public Task SendListingRemovedDueToCategoryDeletionAsync(
            string toEmail,
            string? toName,
            string listingTitle,
            Guid listingId,
            string categoryName,
            string? adminName)
        {
            var safeAdminName = string.IsNullOrWhiteSpace(adminName)
                ? "Администратор"
                : WebUtility.HtmlEncode(adminName);
            var subject = $"{GetOptions().BrandName}: объявление удалено вместе с категорией";
            var body = BuildShell(
                "Объявление удалено вместе с категорией",
                $@"
                    <p>Здравствуйте, {GetSafeName(toName)}.</p>
                    <p>Категория <strong>{WebUtility.HtmlEncode(categoryName)}</strong> была удалена администратором <strong>{safeAdminName}</strong>. Вместе с ней удалено ваше объявление <strong>{WebUtility.HtmlEncode(listingTitle)}</strong> (ID: <strong>{listingId}</strong>).</p>
                    <p>Если вы считаете, что это произошло по ошибке, обратитесь в поддержку сервиса.</p>",
                toEmail);

            return SendEmailAsync(toEmail, toName, subject, body, isBulk: true);
        }

        public Task SendLoginNotificationAsync(
            string toEmail,
            string? toName,
            DateTime loggedAt,
            string? ipAddress,
            string? userAgent)
        {
            var culture = new CultureInfo("ru-RU");
            var subject = $"{GetOptions().BrandName}: вход в аккаунт";
            var body = BuildShell(
                "Вход в аккаунт",
                $@"
                    <p>Здравствуйте, {GetSafeName(toName)}.</p>
                    <p>В ваш аккаунт выполнен вход <strong>{loggedAt.ToString("dd.MM.yyyy HH:mm:ss", culture)}</strong>.</p>
                    <p>IP-адрес: <strong>{WebUtility.HtmlEncode(ipAddress ?? "не определён")}</strong></p>
                    <p>Устройство: <strong>{WebUtility.HtmlEncode(string.IsNullOrWhiteSpace(userAgent) ? "не определено" : userAgent)}</strong></p>
                    <p>Если это были не вы, смените пароль как можно скорее.</p>",
                toEmail);

            return SendEmailAsync(toEmail, toName, subject, body, isBulk: true);
        }

        public Task SendPasswordResetAsync(
            string toEmail,
            string? toName,
            string resetUrl)
        {
            var subject = $"{GetOptions().BrandName}: сброс пароля";
            var safeDisplayUrl = WebUtility.HtmlEncode(resetUrl);
            var body = BuildShell(
                "Сброс пароля",
                $@"
                    <p>Здравствуйте, {GetSafeName(toName)}.</p>
                    <p>Вы запросили сброс пароля. Чтобы задать новый пароль, перейдите по ссылке ниже. Ссылка действительна ограниченное время.</p>
                    <p><a href=""{resetUrl}"" target=""_blank"" rel=""noopener noreferrer"" style=""display:inline-block;padding:10px 18px;background:#000099;color:#ffffff;text-decoration:none;border-radius:4px;"">Установить новый пароль</a></p>
                    <p>Если кнопка не работает, скопируйте адрес: <br/><a href=""{resetUrl}"" target=""_blank"" rel=""noopener noreferrer"" style=""word-break:break-all;color:#000099;"">{safeDisplayUrl}</a></p>
                    <p>Если вы не запрашивали сброс пароля, проигнорируйте это письмо — пароль изменён не будет.</p>");

            return SendEmailAsync(toEmail, toName, subject, body);
        }

        private async Task SendEmailAsync(
            string toEmail,
            string? toName,
            string subject,
            string htmlBody,
            bool isBulk = false)
        {
            var options = GetOptions();
            var senderDomain = options.FromEmail.Contains('@')
                ? options.FromEmail.Split('@')[1]
                : "localhost";
            var message = new MimeMessage();
            message.MessageId = MimeKit.Utils.MimeUtils.GenerateMessageId(senderDomain);
            message.From.Add(CreateMailboxAddress(options.FromEmail, options.FromName));
            message.To.Add(CreateMailboxAddress(toEmail, toName));
            message.Subject = subject;

            if (isBulk)
            {
                var unsubscribeUrl = BuildUrl("/user/settings");
                message.Headers.Add("Precedence", "bulk");
                message.Headers.Add("List-Unsubscribe", $"<{unsubscribeUrl}>");
                message.Headers.Add("List-Unsubscribe-Post", "List-Unsubscribe=One-Click");
            }

            message.Body = new BodyBuilder
            {
                HtmlBody = htmlBody,
                TextBody = HtmlToPlainText(htmlBody)
            }.ToMessageBody();

            using var timeoutCancellationTokenSource = new CancellationTokenSource(
                TimeSpan.FromSeconds(options.TimeoutSeconds));
            using var client = new MailKit.Net.Smtp.SmtpClient();
            client.CheckCertificateRevocation = options.CheckCertificateRevocation;
            await client.ConnectAsync(
                options.Host,
                options.Port,
                GetSecureSocketOptions(options),
                timeoutCancellationTokenSource.Token);

            if (!string.IsNullOrWhiteSpace(options.Username))
            {
                try
                {
                    await client.AuthenticateAsync(
                        options.Username,
                        options.Password ?? string.Empty,
                        timeoutCancellationTokenSource.Token);
                }
                catch (AuthenticationException exception)
                {
                    throw CreateSmtpAuthenticationException(options, exception);
                }
            }

            await client.SendAsync(message, timeoutCancellationTokenSource.Token);
            await client.DisconnectAsync(true, timeoutCancellationTokenSource.Token);
        }

        private static string HtmlToPlainText(string html)
        {
            var text = Regex.Replace(html, @"<br\s*/?>", "\n", RegexOptions.IgnoreCase);
            text = Regex.Replace(text, @"</p>", "\n\n", RegexOptions.IgnoreCase);
            text = Regex.Replace(text, @"</tr>", "\n", RegexOptions.IgnoreCase);
            text = Regex.Replace(text, @"<[^>]+>", string.Empty);
            text = WebUtility.HtmlDecode(text);
            text = Regex.Replace(text, @"[ \t]+", " ");
            text = Regex.Replace(text, @"(\s*\n\s*){3,}", "\n\n");
            return text.Trim();
        }

        private static MailboxAddress CreateMailboxAddress(string email, string? name)
        {
            return string.IsNullOrWhiteSpace(name)
                ? new MailboxAddress(string.Empty, email)
                : new MailboxAddress(name, email);
        }

        private static SecureSocketOptions GetSecureSocketOptions(NotificationEmailOptions options)
        {
            if (!options.EnableSsl)
            {
                return SecureSocketOptions.None;
            }

            return options.Port == 465
                ? SecureSocketOptions.SslOnConnect
                : SecureSocketOptions.StartTls;
        }

        private string BuildShell(string title, string innerHtml, string? recipientEmail = null)
        {
            var options = GetOptions();
            var unsubscribeFooter = string.Empty;

            if (!string.IsNullOrWhiteSpace(recipientEmail))
            {
                var settingsUrl = BuildUrl("/user/settings");
                unsubscribeFooter = $@"
          <tr>
            <td style=""padding:14px 28px;background:#ffffcc;border-top:2px solid #ff9900;font-size:12px;color:#663300;text-align:center;"">
              Это письмо отправлено на адрес {WebUtility.HtmlEncode(recipientEmail)}.
              <a href=""{settingsUrl}"" style=""color:#000099;"">Настроить уведомления</a>
            </td>
          </tr>";
            }

            return $@"
<!DOCTYPE html>
<html lang=""ru"">
<head>
  <meta charset=""UTF-8"" />
  <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"" />
  <title>{WebUtility.HtmlEncode(title)}</title>
</head>
<body style=""margin:0;padding:0;background:#fff8e5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Verdana,Arial,sans-serif;color:#333333;"">
  <table role=""presentation"" width=""100%"" cellpadding=""0"" cellspacing=""0"" style=""background:#fff8e5;padding:24px 12px;"">
    <tr>
      <td align=""center"">
        <table role=""presentation"" width=""640"" cellpadding=""0"" cellspacing=""0"" style=""max-width:640px;background:#ffffff;border:3px solid #ff9900;box-shadow:6px 6px 0 rgba(0,0,0,0.2);"">
          <tr>
            <td style=""padding:20px 28px;background:#ffcc00;border-bottom:3px solid #ff6600;"">
              <div style=""font-size:22px;font-weight:700;color:#000000;"">{WebUtility.HtmlEncode(options.BrandName)}</div>
              <div style=""margin-top:6px;font-size:14px;font-weight:600;color:#000099;"">{WebUtility.HtmlEncode(title)}</div>
            </td>
          </tr>
          <tr>
            <td style=""padding:28px;font-size:15px;line-height:1.6;background:#ffffff;"">
              {innerHtml}
            </td>
          </tr>{unsubscribeFooter}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>";
        }

        private string BuildUrl(string path)
        {
            var baseUrl = configuration["Frontend:BaseUrl"];
            if (string.IsNullOrWhiteSpace(baseUrl))
            {
                baseUrl = Environment.GetEnvironmentVariable("FRONTEND_BASE_URL");
            }

            baseUrl = NormalizeFrontendBaseUrl(baseUrl);
            var normalizedPath = string.IsNullOrWhiteSpace(path)
                ? string.Empty
                : path.StartsWith('/') ? path : $"/{path}";

            return $"{baseUrl}{normalizedPath}";
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

        private string GetSafeName(string? name)
        {
            return string.IsNullOrWhiteSpace(name)
                ? "пользователь"
                : WebUtility.HtmlEncode(name);
        }

        private string TrimPreview(string value)
        {
            var normalized = value.Trim();
            if (normalized.Length <= 200)
            {
                return normalized;
            }

            return $"{normalized[..197]}...";
        }

        private NotificationEmailOptions GetOptions()
        {
            return new NotificationEmailOptions
            {
                Host = GetRequired("Email:SmtpHost", "SMTP_HOST"),
                Port = GetInt("Email:SmtpPort", "SMTP_PORT", 587),
                Username = GetOptional("Email:SmtpUser", "SMTP_USER"),
                Password = GetOptional("Email:SmtpPass", "SMTP_PASS"),
                FromEmail = GetRequired("Email:FromEmail", "SMTP_FROM"),
                FromName = GetOptional("Email:FromName", "SMTP_FROM_NAME") ?? "Secondhand Marketplace",
                BrandName = GetOptional("Email:BrandName", "MARKETPLACE_NAME") ?? "Secondhand Marketplace",
                EnableSsl = GetBool("Email:EnableSsl", "SMTP_ENABLE_SSL", true),
                CheckCertificateRevocation = GetBool(
                    "Email:CheckCertificateRevocation",
                    "SMTP_CHECK_CERTIFICATE_REVOCATION",
                    true),
                TimeoutSeconds = GetInt("Email:SmtpTimeoutSeconds", "SMTP_TIMEOUT_SECONDS", 20)
            };
        }

        private string GetRequired(string key, string envKey)
        {
            var value = configuration[key];
            if (string.IsNullOrWhiteSpace(value))
            {
                value = Environment.GetEnvironmentVariable(envKey);
            }

            if (string.IsNullOrWhiteSpace(value))
            {
                throw new InvalidOperationException($"Missing email configuration: {key} / {envKey}");
            }

            return value;
        }

        private string? GetOptional(string key, string envKey)
        {
            var value = configuration[key];
            if (string.IsNullOrWhiteSpace(value))
            {
                value = Environment.GetEnvironmentVariable(envKey);
            }

            return string.IsNullOrWhiteSpace(value) ? null : value;
        }

        private int GetInt(string key, string envKey, int fallback)
        {
            var raw = GetOptional(key, envKey);
            return int.TryParse(raw, out var parsed) ? parsed : fallback;
        }

        private bool GetBool(string key, string envKey, bool fallback)
        {
            var raw = GetOptional(key, envKey);
            return bool.TryParse(raw, out var parsed) ? parsed : fallback;
        }

        private static InvalidOperationException CreateSmtpAuthenticationException(
            NotificationEmailOptions options,
            AuthenticationException exception)
        {
            var providerHint = IsMailRuHost(options.Host)
                ? "Mail.ru требует пароль приложения. Сгенерируйте его в настройках безопасности Mail.ru и обновите SMTP_PASS."
                : "Проверьте корректность SMTP_USER и SMTP_PASS.";
            var message =
                $"SMTP authentication failed for '{options.Host}' (user '{options.Username ?? "<empty>"}'). {providerHint}";
            return new InvalidOperationException(message, exception);
        }

        private static bool IsMailRuHost(string host)
        {
            return !string.IsNullOrWhiteSpace(host) &&
                   host.Contains("mail.ru", StringComparison.OrdinalIgnoreCase);
        }

        private sealed class NotificationEmailOptions
        {
            public string Host { get; init; } = string.Empty;
            public int Port { get; init; }
            public string? Username { get; init; }
            public string? Password { get; init; }
            public string FromEmail { get; init; } = string.Empty;
            public string FromName { get; init; } = string.Empty;
            public string BrandName { get; init; } = string.Empty;
            public bool EnableSsl { get; init; }
            public bool CheckCertificateRevocation { get; init; }
            public int TimeoutSeconds { get; init; }
        }
    }
}

