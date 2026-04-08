using System.ComponentModel.DataAnnotations;

namespace WebApi.ApiDtos.ListingProperties
{
    public class CreateListingPropertyRequest
    {
        [Required]
        [StringLength(80, MinimumLength = 2)]
        public string Name { get; set; }
    }
}
