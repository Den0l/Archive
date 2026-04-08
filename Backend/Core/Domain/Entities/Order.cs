using Domain.Common;
using System;

namespace Domain.Entities
{
    public enum OrderStatus
    {
        Pending = 0,
        Cancelled = 1,
        Completed = 2
    }

    public class Order : IEntity
    {
        public Guid Id { get; set; }
        public Guid ListingId { get; set; }
        public Listing Listing { get; set; }
        public Guid BuyerId { get; set; }
        public Guid SellerId { get; set; }
        public Guid ConversationId { get; set; }
        public OrderStatus Status { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? CancelledAt { get; set; }
    }
}
