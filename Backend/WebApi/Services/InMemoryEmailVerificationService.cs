using System.Collections.Concurrent;
using System.Security.Cryptography;

namespace WebApi.Services
{
    public sealed class InMemoryEmailVerificationService : IEmailVerificationService
    {
        private const int EmailCodeLifetimeMinutes = 15;

        private readonly ConcurrentDictionary<Guid, EmailCodeEntry> codes = new();

        public string IssueCode(Guid userId, string email, string purpose)
        {
            var code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
            codes[userId] = new EmailCodeEntry(
                code,
                email,
                purpose,
                DateTime.Now.AddMinutes(EmailCodeLifetimeMinutes));
            return code;
        }

        public bool TryConsumeCode(
            Guid userId,
            string expectedEmail,
            string expectedPurpose,
            string code)
        {
            if (!codes.TryGetValue(userId, out var entry))
            {
                return false;
            }

            if (entry.ExpiresAt < DateTime.Now)
            {
                codes.TryRemove(userId, out _);
                return false;
            }

            if (!string.Equals(entry.Email, expectedEmail, StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            if (!string.Equals(entry.Purpose, expectedPurpose, StringComparison.Ordinal))
            {
                return false;
            }

            if (!string.Equals(entry.Code, code, StringComparison.Ordinal))
            {
                return false;
            }

            codes.TryRemove(userId, out _);
            return true;
        }

        public void RevokeCode(Guid userId)
        {
            codes.TryRemove(userId, out _);
        }

        private sealed record EmailCodeEntry(
            string Code,
            string Email,
            string Purpose,
            DateTime ExpiresAt);
    }
}
