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
    public class SellerSubscriptionRepository : ISellerSubscriptionRepository
    {
        private readonly MarketplaceDbContext dbContext;

        public SellerSubscriptionRepository(MarketplaceDbContext dbContext)
        {
            this.dbContext = dbContext;
        }

        public async Task<List<SellerSubscription>> GetBySubscriberIdAsync(Guid subscriberId)
        {
            return await dbContext.SellerSubscriptions
                .AsNoTracking()
                .Where(subscription => subscription.SubscriberId == subscriberId)
                .OrderByDescending(subscription => subscription.CreatedAt)
                .ToListAsync();
        }

        public async Task<List<Guid>> GetSubscriberIdsBySellerIdAsync(Guid sellerId)
        {
            return await dbContext.SellerSubscriptions
                .AsNoTracking()
                .Where(subscription => subscription.SellerId == sellerId)
                .Select(subscription => subscription.SubscriberId)
                .ToListAsync();
        }

        public async Task<bool> IsSubscribedAsync(Guid subscriberId, Guid sellerId)
        {
            return await dbContext.SellerSubscriptions.AnyAsync(
                subscription => subscription.SubscriberId == subscriberId
                    && subscription.SellerId == sellerId);
        }

        public async Task<SellerSubscription> AddAsync(Guid subscriberId, Guid sellerId)
        {
            var existing = await dbContext.SellerSubscriptions.FirstOrDefaultAsync(
                subscription => subscription.SubscriberId == subscriberId
                    && subscription.SellerId == sellerId);

            if (existing != null)
            {
                return existing;
            }

            var subscriptionToAdd = new SellerSubscription
            {
                SubscriberId = subscriberId,
                SellerId = sellerId,
                CreatedAt = DateTime.Now
            };

            dbContext.SellerSubscriptions.Add(subscriptionToAdd);
            await dbContext.SaveChangesAsync();
            return subscriptionToAdd;
        }

        public async Task<bool> RemoveAsync(Guid subscriberId, Guid sellerId)
        {
            var existing = await dbContext.SellerSubscriptions.FirstOrDefaultAsync(
                subscription => subscription.SubscriberId == subscriberId
                    && subscription.SellerId == sellerId);

            if (existing == null)
            {
                return false;
            }

            dbContext.SellerSubscriptions.Remove(existing);
            await dbContext.SaveChangesAsync();
            return true;
        }
    }
}
