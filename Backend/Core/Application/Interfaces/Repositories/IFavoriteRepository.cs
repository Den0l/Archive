using Domain.Entities;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Application.Interfaces.Repositories
{
    public interface IFavoriteRepository
    {
        Task<List<FavoriteItem>> GetByUserIdAsync(Guid userId);
        Task<FavoriteItem?> AddAsync(Guid userId, Guid listingId);
        Task<bool> RemoveAsync(Guid userId, Guid listingId);
    }
}
