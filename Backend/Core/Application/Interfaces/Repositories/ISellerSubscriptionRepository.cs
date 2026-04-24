using Domain.Entities;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Application.Interfaces.Repositories
{
    public interface ISellerSubscriptionRepository
    {
        Task<List<SellerSubscription>> GetBySubscriberIdAsync(Guid subscriberId);
        Task<List<Guid>> GetSubscriberIdsBySellerIdAsync(Guid sellerId);
        Task<bool> IsSubscribedAsync(Guid subscriberId, Guid sellerId);
        Task<SellerSubscription> AddAsync(Guid subscriberId, Guid sellerId);
        Task<bool> RemoveAsync(Guid subscriberId, Guid sellerId);
    }
}
