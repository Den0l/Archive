using System.ComponentModel.DataAnnotations;

namespace WebApi.ApiDtos.ListingProperties
{
    public class UpdateListingPropertyRequest
    {
        [Required]
        [StringLength(80, MinimumLength = 2)]
        public string Name { get; set; }
    }
}
