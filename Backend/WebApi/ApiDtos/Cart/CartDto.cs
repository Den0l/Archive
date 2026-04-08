namespace WebApi.ApiDtos.Cart
{
    public class CartDto
    {
        public List<CartItemDto> Items { get; set; }
        public int TotalItems { get; set; }
        public decimal TotalPrice { get; set; }
    }
}
