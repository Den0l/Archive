using WebApi.ApiDtos.Listings;

namespace WebApi.ApiDtos.Favorites
{
    public class FavoriteItemDto
    {
        public Guid ListingId { get; set; }
        public ListingDto Listing { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
