using Domain.Entities;
using Infrastructure.Persistence.Contexts;
using Microsoft.EntityFrameworkCore;

namespace WebApi.Services
{
    public sealed class ListingViewTracker : IListingViewTracker
    {
        private readonly MarketplaceDbContext dbContext;

        public ListingViewTracker(MarketplaceDbContext dbContext)
        {
            this.dbContext = dbContext;
        }

        public async Task<bool> TrackAsync(
            Guid listingId,
            Guid? viewerUserId,
            string? guestFingerprint,
            CancellationToken cancellationToken = default)
        {
            if (viewerUserId.HasValue)
            {
                return await TrackAuthenticatedAsync(
                    listingId,
                    viewerUserId.Value,
                    cancellationToken);
            }

            if (!string.IsNullOrWhiteSpace(guestFingerprint))
            {
                return await TrackGuestAsync(
                    listingId,
                    guestFingerprint,
                    cancellationToken);
            }

            return false;
        }

        private async Task<bool> TrackAuthenticatedAsync(
            Guid listingId,
            Guid viewerId,
            CancellationToken cancellationToken)
        {
            var hasViewedAlready = await dbContext.ListingViews.AnyAsync(
                listingView =>
                    listingView.ListingId == listingId &&
                    listingView.ViewerId == viewerId,
                cancellationToken);

            if (hasViewedAlready)
            {
                return false;
            }

            try
            {
                dbContext.ListingViews.Add(new ListingView
                {
                    ListingId = listingId,
                    ViewerId = viewerId,
                    ViewedAt = DateTime.Now,
                });
                await dbContext.SaveChangesAsync(cancellationToken);
                await IncrementViewCountAsync(listingId, cancellationToken);
                return true;
            }
            catch (DbUpdateException)
            {
                return false;
            }
        }

        private async Task<bool> TrackGuestAsync(
            Guid listingId,
            string guestFingerprint,
            CancellationToken cancellationToken)
        {
            var hasViewedAlready = await dbContext.ListingGuestViews.AnyAsync(
                listingGuestView =>
                    listingGuestView.ListingId == listingId &&
                    listingGuestView.ViewerFingerprint == guestFingerprint,
                cancellationToken);

            if (hasViewedAlready)
            {
                return false;
            }

            try
            {
                dbContext.ListingGuestViews.Add(new ListingGuestView
                {
                    ListingId = listingId,
                    ViewerFingerprint = guestFingerprint,
                    ViewedAt = DateTime.Now,
                });
                await dbContext.SaveChangesAsync(cancellationToken);
                await IncrementViewCountAsync(listingId, cancellationToken);
                return true;
            }
            catch (DbUpdateException)
            {
                return false;
            }
        }

        private Task IncrementViewCountAsync(
            Guid listingId,
            CancellationToken cancellationToken)
        {
            return dbContext.Listings
                .Where(listing => listing.Id == listingId)
                .ExecuteUpdateAsync(
                    setters => setters.SetProperty(
                        listing => listing.ViewCount,
                        listing => listing.ViewCount + 1),
                    cancellationToken);
        }
    }
}
