using System;

namespace Domain.Entities
{
    /// <summary>
    /// Represents a listing saved in a user's cart.
    /// </summary>
    public class CartItem
    {
        public Guid UserId { get; set; }
        public Guid ListingId { get; set; }
        public Listing Listing { get; set; }
        public int Quantity { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
