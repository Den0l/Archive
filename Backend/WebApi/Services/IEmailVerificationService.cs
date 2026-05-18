namespace WebApi.Services
{
    public interface IEmailVerificationService
    {
        string IssueCode(Guid userId, string email, string purpose);

        bool TryConsumeCode(
            Guid userId,
            string expectedEmail,
            string expectedPurpose,
            string code);

        void RevokeCode(Guid userId);
    }
}
