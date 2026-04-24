using System;

namespace Domain.Entities
{
    public class SellerSubscription
    {
        public Guid SubscriberId { get; set; }
        public Guid SellerId { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
