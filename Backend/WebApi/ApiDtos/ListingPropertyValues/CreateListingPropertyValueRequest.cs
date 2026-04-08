using System.ComponentModel.DataAnnotations;
using WebApi.Validation;

namespace WebApi.ApiDtos.ListingPropertyValues
{
    public class CreateListingPropertyValueRequest
    {
        [Required]
        [StringLength(80, MinimumLength = 2)]
        public string Name { get; set; }

        [NotEmptyGuid]
        public Guid ListingPropertyId { get; set; }
    }
}
