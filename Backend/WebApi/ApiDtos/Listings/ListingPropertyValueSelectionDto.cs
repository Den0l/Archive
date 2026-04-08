using Application.Interfaces;
using WebApi.Validation;

namespace WebApi.ApiDtos.Listings
{
    public class ListingPropertyValueSelectionDto : IListingPropertyValueSelection
    {
        [NotEmptyGuid]
        public Guid ListingPropertyId { get; set; }

        [NotEmptyGuid]
        public Guid SelectedListingPropertyValueId { get; set; }
    }
}
