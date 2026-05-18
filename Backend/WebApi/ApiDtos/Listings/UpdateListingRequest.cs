using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using WebApi.Validation;

namespace WebApi.ApiDtos.Listings
{
    public class UpdateListingRequest
    {
        [Range(typeof(decimal), "1", "100000000")]
        public decimal Price { get; set; }

        [NotEmptyGuid]
        public Guid StateOfItemId { get; set; }

        [Required]
        [StringLength(120, MinimumLength = 3)]
        public string Title { get; set; }

        [StringLength(2000)]
        public string? Description { get; set; }

        [NotEmptyGuid]
        public Guid CategoryId { get; set; }

        [NotEmptyGuid]
        public Guid CityId { get; set; }

        [Required]
        public List<ListingPropertyValueSelectionDto> PropertyValueSelection { get; set; }

        public bool IsSold { get; set; }
        public bool IsArchived { get; set; }
    }
}
