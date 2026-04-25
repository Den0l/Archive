using Application.Interfaces.Repositories;
using Domain.Entities;
using Infrastructure.Persistence.Contexts;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Persistence.Repositories
{
    public class OrderRepository : CrudRepositoryBase<Order>, IOrderRepository
    {
        public OrderRepository(MarketplaceDbContext dbContext) : base(dbContext)
        {
        }

        protected override DbSet<Order> Entities => dbContext.Orders;

        protected override IQueryable<Order> Query() =>
            dbContext.Orders
                .Include(o => o.Listing)
                    .ThenInclude(l => l.Images);

        public Task<Order?> GetByConversationIdAsync(Guid conversationId) =>
            Query()
                .Where(o => o.ConversationId == conversationId)
                .OrderByDescending(o => o.CreatedAt)
                .FirstOrDefaultAsync();

        public Task<List<Order>> GetAllByConversationIdAsync(Guid conversationId) =>
            Query()
                .Where(o => o.ConversationId == conversationId)
                .OrderByDescending(o => o.CreatedAt)
                .ToListAsync();

        public Task<Order?> GetLatestPendingByListingIdAsync(Guid listingId) =>
            Query()
                .Where(o => o.ListingId == listingId && o.Status == OrderStatus.Pending)
                .OrderByDescending(o => o.CreatedAt)
                .FirstOrDefaultAsync();

        public Task<List<Order>> GetByBuyerIdAsync(Guid buyerId) =>
            Query()
                .Where(o => o.BuyerId == buyerId)
                .OrderByDescending(o => o.CreatedAt)
                .ToListAsync();

        public Task<List<Order>> GetBySellerIdAsync(Guid sellerId) =>
            Query()
                .Where(o => o.SellerId == sellerId)
                .OrderByDescending(o => o.CreatedAt)
                .ToListAsync();

        public async Task UpdateAsync(Order order)
        {
            dbContext.Orders.Update(order);
            await dbContext.SaveChangesAsync();
        }
    }
}
