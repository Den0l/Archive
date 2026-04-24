namespace WebApi.Services
{
    public interface INotificationEmailService
    {
        Task SendEmailChangeConfirmationAsync(
            Guid userId,
            string toEmail,
            string? toName,
            string newEmail,
            string token);
        Task SendEmailVerificationCodeAsync(
            string toEmail,
            string? toName,
            string code);
        Task SendEmailChangeCodeAsync(
            string toEmail,
            string? toName,
            string newEmail,
            string code);

        Task SendNewMessageNotificationAsync(
            string toEmail,
            string? toName,
            string senderName,
            string messagePreview,
            Guid conversationId);

        Task SendSellerOrderNotificationAsync(
            string toEmail,
            string? toName,
            string buyerName,
            string listingTitle);

        Task SendFollowedSellerListingNotificationAsync(
            string toEmail,
            string? toName,
            string sellerName,
            string listingTitle,
            Guid listingId);

        Task SendListingRemovedByAdminNotificationAsync(
            string toEmail,
            string? toName,
            string listingTitle,
            Guid listingId,
            string? adminName);

        Task SendListingRemovedDueToCategoryDeletionAsync(
            string toEmail,
            string? toName,
            string listingTitle,
            Guid listingId,
            string categoryName,
            string? adminName);

        Task SendLoginNotificationAsync(
            string toEmail,
            string? toName,
            DateTime loggedAt,
            string? ipAddress,
            string? userAgent);

        Task SendPasswordResetAsync(
            string toEmail,
            string? toName,
            string newPassword);
    }
}
