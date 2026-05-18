using System.ComponentModel.DataAnnotations;
using WebApi.Validation;

namespace WebApi.ApiDtos.Cart
{
    public class AddCartItemRequest
    {
        [NotEmptyGuid]
        public Guid ListingId { get; set; }

        [Range(1, 999)]
        public int Quantity { get; set; } = 1;
    }
}
