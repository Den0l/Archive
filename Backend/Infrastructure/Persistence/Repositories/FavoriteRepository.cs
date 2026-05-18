using Application.Interfaces.Repositories;
using Domain.Entities;
using Infrastructure.Persistence.Contexts;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Infrastructure.Persistence.Repositories
{
    public class FavoriteRepository : IFavoriteRepository
    {
        private readonly MarketplaceDbContext dbContext;

        public FavoriteRepository(MarketplaceDbContext dbContext)
        {
            this.dbContext = dbContext;
        }

        public async Task<List<FavoriteItem>> GetByUserIdAsync(Guid userId)
        {
            // Cleanup legacy records where a user favorited their own listing.
            var ownFavorites = await dbContext.FavoriteItems
                .Where(fi => fi.UserId == userId && fi.Listing.SellerId == userId)
                .ToListAsync();
            if (ownFavorites.Count > 0)
            {
                dbContext.FavoriteItems.RemoveRange(ownFavorites);
                await dbContext.SaveChangesAsync();
            }

            return await dbContext.FavoriteItems
                .Include(fi => fi.Listing)
                    .ThenInclude(l => l.Images)
                .Where(fi => fi.UserId == userId && fi.Listing.SellerId != userId)
                .ToListAsync();
        }

        public async Task<FavoriteItem?> AddAsync(Guid userId, Guid listingId)
        {
            var listingOwnerId = await dbContext.Listings
                .Where(l => l.Id == listingId)
                .Select(l => (Guid?)l.SellerId)
                .FirstOrDefaultAsync();
            if (!listingOwnerId.HasValue)
            {
                return null;
            }

            if (listingOwnerId.Value == userId)
            {
                var ownFavorite = await dbContext.FavoriteItems
                    .FirstOrDefaultAsync(fi => fi.UserId == userId && fi.ListingId == listingId);
                if (ownFavorite != null)
                {
                    dbContext.FavoriteItems.Remove(ownFavorite);
                    await dbContext.SaveChangesAsync();
                }

                return null;
            }

            var existing = await dbContext.FavoriteItems
                .FirstOrDefaultAsync(fi => fi.UserId == userId && fi.ListingId == listingId);
            if (existing != null)
                return await LoadWithListingAsync(userId, listingId);

            var item = new FavoriteItem
            {
                UserId = userId,
                ListingId = listingId,
                CreatedAt = DateTime.Now
            };

            dbContext.FavoriteItems.Add(item);
            await dbContext.SaveChangesAsync();
            return await LoadWithListingAsync(userId, listingId);
        }

        public async Task<bool> RemoveAsync(Guid userId, Guid listingId)
        {
            var existing = await dbContext.FavoriteItems
                .FirstOrDefaultAsync(fi => fi.UserId == userId && fi.ListingId == listingId);
            if (existing == null)
                return false;

            dbContext.FavoriteItems.Remove(existing);
            await dbContext.SaveChangesAsync();
            return true;
        }

        private Task<FavoriteItem?> LoadWithListingAsync(Guid userId, Guid listingId)
        {
            return dbContext.FavoriteItems
                .Include(fi => fi.Listing)
                    .ThenInclude(l => l.Images)
                .FirstOrDefaultAsync(fi => fi.UserId == userId && fi.ListingId == listingId);
        }
    }
}
