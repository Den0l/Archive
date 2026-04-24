using Application.Interfaces.Repositories;
using Domain.Entities;
using Infrastructure.Persistence.Contexts;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace Infrastructure.Persistence.Repositories
{
    public class OrderRepository : IOrderRepository
    {
        private readonly MarketplaceDbContext dbContext;

        public OrderRepository(MarketplaceDbContext dbContext)
        {
            this.dbContext = dbContext;
        }

        public async Task<Order> CreateAsync(Order order)
        {
            dbContext.Orders.Add(order);
            await dbContext.SaveChangesAsync();
            return order;
        }

        public async Task<Order?> GetByIdAsync(Guid id)
        {
            return await dbContext.Orders
                .Include(o => o.Listing)
                    .ThenInclude(l => l.Images)
                .FirstOrDefaultAsync(o => o.Id == id);
        }

        public async Task<Order?> GetByConversationIdAsync(Guid conversationId)
        {
            return await dbContext.Orders
                .Include(o => o.Listing)
                    .ThenInclude(l => l.Images)
                .Where(o => o.ConversationId == conversationId)
                .OrderByDescending(o => o.CreatedAt)
                .FirstOrDefaultAsync();
        }

        public async Task<List<Order>> GetAllByConversationIdAsync(Guid conversationId)
        {
            return await dbContext.Orders
                .Include(o => o.Listing)
                    .ThenInclude(l => l.Images)
                .Where(o => o.ConversationId == conversationId)
                .OrderByDescending(o => o.CreatedAt)
                .ToListAsync();
        }

        public async Task<Order?> GetLatestPendingByListingIdAsync(Guid listingId)
        {
            return await dbContext.Orders
                .Include(o => o.Listing)
                    .ThenInclude(l => l.Images)
                .Where(o =>
                    o.ListingId == listingId &&
                    o.Status == OrderStatus.Pending)
                .OrderByDescending(o => o.CreatedAt)
                .FirstOrDefaultAsync();
        }

        public async Task<List<Order>> GetByBuyerIdAsync(Guid buyerId)
        {
            return await dbContext.Orders
                .Include(o => o.Listing)
                    .ThenInclude(l => l.Images)
                .Where(o => o.BuyerId == buyerId)
                .OrderByDescending(o => o.CreatedAt)
                .ToListAsync();
        }

        public async Task<List<Order>> GetBySellerIdAsync(Guid sellerId)
        {
            return await dbContext.Orders
                .Include(o => o.Listing)
                    .ThenInclude(l => l.Images)
                .Where(o => o.SellerId == sellerId)
                .OrderByDescending(o => o.CreatedAt)
                .ToListAsync();
        }

        public async Task UpdateAsync(Order order)
        {
            dbContext.Orders.Update(order);
            await dbContext.SaveChangesAsync();
        }
    }
}
