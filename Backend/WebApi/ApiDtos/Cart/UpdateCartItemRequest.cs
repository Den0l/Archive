using System.ComponentModel.DataAnnotations;

namespace WebApi.ApiDtos.Cart
{
    public class UpdateCartItemRequest
    {
        [Range(1, 999)]
        public int Quantity { get; set; }
    }
}
