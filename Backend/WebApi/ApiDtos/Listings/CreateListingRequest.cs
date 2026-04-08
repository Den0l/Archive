using Application.Interfaces;
using System.ComponentModel.DataAnnotations;
using WebApi.Validation;

namespace WebApi.ApiDtos.Listings
{
    /// <summary>
    /// For adding pictures, use different request. This is only for the listing itself
    /// </summary>
    public class CreateListingRequest
    {
        [Range(typeof(decimal), "1", "1000000")]
        public decimal Price { get; set; }

        [NotEmptyGuid]
        public Guid StateOfItemId { get; set; }

        [Required]
        [StringLength(120, MinimumLength = 5)]
        public string Title { get; set; }

        [Required]
        [StringLength(2000, MinimumLength = 20)]
        public string Description { get; set; }

        [NotEmptyGuid]
        public Guid CategoryId { get; set; }

        [NotEmptyGuid]
        public Guid CityId { get; set; }

        [Required]
        public List<ListingPropertyValueSelectionDto> PropertyValueSelection { get; set; }
    }
}
