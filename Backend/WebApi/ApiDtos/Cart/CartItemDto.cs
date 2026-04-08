using WebApi.ApiDtos.Listings;

namespace WebApi.ApiDtos.Cart
{
    public class CartItemDto
    {
        public Guid ListingId { get; set; }
        public ListingDto Listing { get; set; }
        public int Quantity { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
