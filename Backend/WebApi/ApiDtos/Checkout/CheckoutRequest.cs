using System;
using System.Collections.Generic;

namespace WebApi.ApiDtos.Checkout
{
    public class CheckoutItemDto
    {
        public Guid ListingId { get; set; }
        public string Title { get; set; } = string.Empty;
        public decimal Price { get; set; }
        public int Quantity { get; set; }
    }

    public class CheckoutRequest
    {
        public List<CheckoutItemDto> Items { get; set; } = new();
        public int TotalItems { get; set; }
        public decimal TotalPrice { get; set; }
    }
}
