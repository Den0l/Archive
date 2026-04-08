using Domain.Entities;
using System;

namespace WebApi.ApiDtos.Orders
{
    public class OrderDto
    {
        public Guid Id { get; set; }
        public Guid ListingId { get; set; }
        public string ListingTitle { get; set; } = string.Empty;
        public Guid BuyerId { get; set; }
        public string BuyerNickname { get; set; } = string.Empty;
        public Guid SellerId { get; set; }
        public Guid ConversationId { get; set; }
        public OrderStatus Status { get; set; }
        public DateTime CreatedAt { get; set; }
        public bool IsListingSold { get; set; }
        public bool IsListingArchived { get; set; }
    }
}
