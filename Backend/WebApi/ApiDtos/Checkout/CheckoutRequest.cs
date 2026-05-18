using System.ComponentModel.DataAnnotations;
using WebApi.Validation;

namespace WebApi.ApiDtos.Checkout
{
    public class CheckoutItemDto
    {
        [NotEmptyGuid]
        public Guid ListingId { get; set; }

        public string Title { get; set; } = string.Empty;

        [Range(0, double.MaxValue)]
        public decimal Price { get; set; }

        [Range(1, 999)]
        public int Quantity { get; set; }
    }

    public class CheckoutRequest
    {
        [Required]
        [MinLength(1)]
        public List<CheckoutItemDto> Items { get; set; } = new();

        public int TotalItems { get; set; }

        public decimal TotalPrice { get; set; }
    }
}
