using WebApi.Validation;

namespace WebApi.ApiDtos.Favorites
{
    public class AddFavoriteRequest
    {
        [NotEmptyGuid]
        public Guid ListingId { get; set; }
    }
}
