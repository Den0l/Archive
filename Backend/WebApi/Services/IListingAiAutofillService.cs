using Microsoft.AspNetCore.Http;
using WebApi.ApiDtos.Listings;

namespace WebApi.Services
{
    public sealed class ListingAiAutofillInput
    {
        public Guid? ListingId { get; set; }

        public string? DescriptionHint { get; set; }

        public List<Guid> ExistingImageIds { get; set; } = new();

        public List<IFormFile> NewImages { get; set; } = new();
    }

    public interface IListingAiAutofillService
    {
        Task<AiAutofillListingResponse> AutofillAsync(
            ListingAiAutofillInput input,
            CancellationToken cancellationToken = default);
    }
}
