using Microsoft.AspNetCore.Http;

namespace WebApi.ApiDtos.Listings
{
    public class AiAutofillListingRequest
    {
        public Guid? ListingId { get; set; }

        public string? DescriptionHint { get; set; }

        public List<Guid> ExistingImageIds { get; set; } = new();

        public List<IFormFile> NewImages { get; set; } = new();
    }
}
