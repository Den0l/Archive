using System;
using System.Globalization;
using System.Linq;
using System.Net;
using System.Net.Mail;
using System.Text;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using WebApi.ApiDtos.Checkout;

namespace WebApi.Services
{
    public class SmtpReceiptEmailService : IReceiptEmailService
    {
        private readonly IConfiguration configuration;

        public SmtpReceiptEmailService(IConfiguration configuration)
        {
            this.configuration = configuration;
        }

        public async Task SendReceiptAsync(string toEmail, string? toName, CheckoutRequest request)
        {
            var options = GetOptions();
            var fromAddress = new MailAddress(options.FromEmail, options.FromName);
            var toAddress = string.IsNullOrWhiteSpace(toName)
                ? new MailAddress(toEmail)
                : new MailAddress(toEmail, toName);

            var orderNumber = $"MH-{Guid.NewGuid():N}".Substring(0, 10).ToUpperInvariant();
            var issuedAt = DateTime.Now;
            var htmlBody = BuildReceiptHtml(request, orderNumber, issuedAt, options.BrandName, toName);
            var subject = $"{options.BrandName}: чек по заказу {orderNumber}";

            using var message = new MailMessage(fromAddress, toAddress)
            {
                Subject = subject,
                Body = htmlBody,
                IsBodyHtml = true,
                BodyEncoding = Encoding.UTF8,
                SubjectEncoding = Encoding.UTF8
            };

            using var client = new SmtpClient(options.Host, options.Port)
            {
                EnableSsl = options.EnableSsl
            };

            if (!string.IsNullOrWhiteSpace(options.Username))
            {
                client.Credentials = new NetworkCredential(options.Username, options.Password);
            }

            await client.SendMailAsync(message);
        }

        private ReceiptEmailOptions GetOptions()
        {
            return new ReceiptEmailOptions
            {
                Host = GetRequired("Email:SmtpHost", "SMTP_HOST"),
                Port = GetInt("Email:SmtpPort", "SMTP_PORT", 587),
                Username = GetOptional("Email:SmtpUser", "SMTP_USER"),
                Password = GetOptional("Email:SmtpPass", "SMTP_PASS"),
                FromEmail = GetRequired("Email:FromEmail", "SMTP_FROM"),
                FromName = GetOptional("Email:FromName", "SMTP_FROM_NAME") ?? "Secondhand Marketplace",
                BrandName = GetOptional("Email:BrandName", "MARKETPLACE_NAME") ?? "Secondhand Marketplace",
                EnableSsl = GetBool("Email:EnableSsl", "SMTP_ENABLE_SSL", true)
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

        private string BuildReceiptHtml(
            CheckoutRequest request,
            string orderNumber,
            DateTime issuedAt,
            string brandName,
            string? customerName)
        {
            var culture = new CultureInfo("ru-RU");
            var totalItems = request.Items.Sum(i => i.Quantity);
            var totalPrice = request.Items.Sum(i => i.Price * i.Quantity);
            var greetingName = string.IsNullOrWhiteSpace(customerName) ? "друг" : WebUtility.HtmlEncode(customerName);

            var rows = string.Join("", request.Items.Select(item =>
            {
                var title = WebUtility.HtmlEncode(item.Title);
                var price = item.Price.ToString("N2", culture);
                var lineTotal = (item.Price * item.Quantity).ToString("N2", culture);
                return $@"
                    <tr>
                        <td style=""padding:12px 16px;border-bottom:1px solid #ffd9a0;font-weight:600;"">{title}</td>
                        <td style=""padding:12px 16px;border-bottom:1px solid #ffd9a0;text-align:center;"">{item.Quantity}</td>
                        <td style=""padding:12px 16px;border-bottom:1px solid #ffd9a0;text-align:right;"">₽{price}</td>
                        <td style=""padding:12px 16px;border-bottom:1px solid #ffd9a0;text-align:right;font-weight:600;"">₽{lineTotal}</td>
                    </tr>";
            }));

            var issuedAtText = issuedAt.ToString("dd.MM.yyyy HH:mm", culture);

            return $@"
<!DOCTYPE html>
<html lang=""ru"">
<head>
  <meta charset=""UTF-8"" />
  <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"" />
  <title>Чек {orderNumber}</title>
</head>
<body style=""margin:0;background:#fff8e5;font-family:Arial, sans-serif;color:#000000;"">
  <table role=""presentation"" cellpadding=""0"" cellspacing=""0"" width=""100%"" style=""background:#fff8e5;padding:32px 16px;"">
    <tr>
      <td align=""center"">
        <table role=""presentation"" cellpadding=""0"" cellspacing=""0"" width=""600"" style=""max-width:600px;background:#ffffff;border:3px solid #ff9900;box-shadow:6px 6px 0 #cc6600;"">
          <tr>
            <td style=""padding:24px 28px;background:linear-gradient(90deg,#ffcc66,#ffef99);"">
              <div style=""font-size:20px;font-weight:700;color:#000099;"">{WebUtility.HtmlEncode(brandName)}</div>
              <div style=""font-size:14px;color:#663300;"">Чек по заказу {orderNumber}</div>
            </td>
          </tr>
          <tr>
            <td style=""padding:24px 28px;"">
              <div style=""font-size:16px;margin-bottom:12px;"">Привет, {greetingName}!</div>
              <div style=""font-size:14px;color:#444;margin-bottom:20px;"">
                Спасибо за оформление заказа. Ниже — детали покупки от {issuedAtText}.
              </div>
              <table role=""presentation"" width=""100%"" cellpadding=""0"" cellspacing=""0"" style=""border-collapse:collapse;border:2px solid #ff9900;margin-bottom:16px;"">
                <thead>
                  <tr style=""background:#fff1cc;"">
                    <th style=""padding:12px 16px;text-align:left;border-bottom:2px solid #ff9900;color:#000099;"">Товар</th>
                    <th style=""padding:12px 16px;text-align:center;border-bottom:2px solid #ff9900;color:#000099;"">Кол-во</th>
                    <th style=""padding:12px 16px;text-align:right;border-bottom:2px solid #ff9900;color:#000099;"">Цена</th>
                    <th style=""padding:12px 16px;text-align:right;border-bottom:2px solid #ff9900;color:#000099;"">Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {rows}
                </tbody>
              </table>
              <table role=""presentation"" width=""100%"" cellpadding=""0"" cellspacing=""0"" style=""border-collapse:collapse;"">
                <tr>
                  <td style=""padding:8px 0;font-size:14px;color:#000099;font-weight:600;"">Позиций</td>
                  <td style=""padding:8px 0;text-align:right;font-size:14px;"">{totalItems}</td>
                </tr>
                <tr>
                  <td style=""padding:8px 0;font-size:16px;color:#000099;font-weight:700;"">Итого</td>
                  <td style=""padding:8px 0;text-align:right;font-size:16px;font-weight:700;color:#cc0000;"">₽{totalPrice.ToString("N2", culture)}</td>
                </tr>
              </table>
              <div style=""margin-top:20px;padding:16px;background:#fff6da;border:2px dashed #ff9900;font-size:13px;color:#663300;"">
                Если возникнут вопросы — ответьте на это письмо, мы поможем.
              </div>
            </td>
          </tr>
          <tr>
            <td style=""padding:16px 28px;background:#fff1cc;color:#663300;font-size:12px;text-align:center;"">
              {WebUtility.HtmlEncode(brandName)} • Спасибо, что выбираете нас
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>";
        }

        private sealed class ReceiptEmailOptions
        {
            public string Host { get; init; } = string.Empty;
            public int Port { get; init; }
            public string? Username { get; init; }
            public string? Password { get; init; }
            public string FromEmail { get; init; } = string.Empty;
            public string FromName { get; init; } = string.Empty;
            public string BrandName { get; init; } = string.Empty;
            public bool EnableSsl { get; init; }
        }
    }
}
