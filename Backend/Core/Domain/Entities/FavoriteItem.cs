using System;

namespace Domain.Entities
{
    /// <summary>
    /// Represents a listing saved in a user's favorites.
    /// </summary>
    public class FavoriteItem
    {
        public Guid UserId { get; set; }
        public Guid ListingId { get; set; }
        public Listing Listing { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
