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
    public class CartRepository : ICartRepository
    {
        private readonly MarketplaceDbContext dbContext;

        public CartRepository(MarketplaceDbContext dbContext)
        {
            this.dbContext = dbContext;
        }

        public async Task<List<CartItem>> GetByUserIdAsync(Guid userId)
        {
            return await dbContext.CartItems
                .Include(ci => ci.Listing)
                    .ThenInclude(l => l.Images)
                .Where(ci => ci.UserId == userId)
                .ToListAsync();
        }

        public async Task<CartItem?> AddItemAsync(Guid userId, Guid listingId, int quantity)
        {
            if (quantity <= 0)
                return null;

            var listingExists = await dbContext.Listings.AnyAsync(l => l.Id == listingId);
            if (!listingExists)
                return null;

            var existing = await dbContext.CartItems
                .FirstOrDefaultAsync(ci => ci.UserId == userId && ci.ListingId == listingId);

            if (existing != null)
            {
                existing.Quantity += quantity;
                await dbContext.SaveChangesAsync();
                return await LoadWithListingAsync(userId, listingId);
            }

            var item = new CartItem
            {
                UserId = userId,
                ListingId = listingId,
                Quantity = quantity,
                CreatedAt = DateTime.Now
            };

            dbContext.CartItems.Add(item);
            await dbContext.SaveChangesAsync();
            return await LoadWithListingAsync(userId, listingId);
        }

        public async Task<CartItem?> UpdateQuantityAsync(Guid userId, Guid listingId, int quantity)
        {
            if (quantity <= 0)
                return null;

            var existing = await dbContext.CartItems
                .FirstOrDefaultAsync(ci => ci.UserId == userId && ci.ListingId == listingId);
            if (existing == null)
                return null;

            existing.Quantity = quantity;
            await dbContext.SaveChangesAsync();
            return await LoadWithListingAsync(userId, listingId);
        }

        public async Task<bool> RemoveItemAsync(Guid userId, Guid listingId)
        {
            var existing = await dbContext.CartItems
                .FirstOrDefaultAsync(ci => ci.UserId == userId && ci.ListingId == listingId);
            if (existing == null)
                return false;

            dbContext.CartItems.Remove(existing);
            await dbContext.SaveChangesAsync();
            return true;
        }

        public async Task<int> ClearAsync(Guid userId)
        {
            var items = await dbContext.CartItems
                .Where(ci => ci.UserId == userId)
                .ToListAsync();
            if (items.Count == 0)
                return 0;

            dbContext.CartItems.RemoveRange(items);
            await dbContext.SaveChangesAsync();
            return items.Count;
        }

        private Task<CartItem?> LoadWithListingAsync(Guid userId, Guid listingId)
        {
            return dbContext.CartItems
                .Include(ci => ci.Listing)
                    .ThenInclude(l => l.Images)
                .FirstOrDefaultAsync(ci => ci.UserId == userId && ci.ListingId == listingId);
        }
    }
}
