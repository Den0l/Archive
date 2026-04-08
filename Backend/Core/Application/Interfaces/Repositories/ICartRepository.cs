using Domain.Entities;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Application.Interfaces.Repositories
{
    public interface ICartRepository
    {
        Task<List<CartItem>> GetByUserIdAsync(Guid userId);
        Task<CartItem?> AddItemAsync(Guid userId, Guid listingId, int quantity);
        Task<CartItem?> UpdateQuantityAsync(Guid userId, Guid listingId, int quantity);
        Task<bool> RemoveItemAsync(Guid userId, Guid listingId);
        Task<int> ClearAsync(Guid userId);
    }
}
