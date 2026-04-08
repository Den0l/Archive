using Domain.Entities;
using System.Collections.Generic;
using System;
using System.Threading.Tasks;

namespace Application.Interfaces.Repositories
{
    public interface IOrderRepository
    {
        Task<Order> CreateAsync(Order order);
        Task<Order?> GetByIdAsync(Guid id);
        Task<Order?> GetByConversationIdAsync(Guid conversationId);
        Task<List<Order>> GetAllByConversationIdAsync(Guid conversationId);
        Task<Order?> GetLatestPendingByListingIdAsync(Guid listingId);
        Task UpdateAsync(Order order);
    }
}
