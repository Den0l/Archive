using System.ComponentModel.DataAnnotations;

namespace WebApi.ApiDtos.ListingPropertyValues
{
    public class UpdateListingPropertyValueRequest
    {
        [Required]
        [StringLength(80, MinimumLength = 2)]
        public string Name { get; set; }
    }
}
