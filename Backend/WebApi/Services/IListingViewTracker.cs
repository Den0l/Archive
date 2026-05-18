namespace WebApi.Services
{
    public interface IListingViewTracker
    {
        Task<bool> TrackAsync(
            Guid listingId,
            Guid? viewerUserId,
            string? guestFingerprint,
            CancellationToken cancellationToken = default);
    }
}
