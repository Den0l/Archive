namespace WebApi.ApiDtos.Cart
{
    public class AddCartItemRequest
    {
        public Guid ListingId { get; set; }
        public int Quantity { get; set; } = 1;
    }
}
