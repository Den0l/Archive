namespace WebApi.ApiDtos.Listings
{
    public class AiAutofillListingResponse
    {
        public string Title { get; set; } = string.Empty;

        public string Description { get; set; } = string.Empty;

        public Guid StateOfItemId { get; set; }

        public Guid CategoryId { get; set; }

        public List<ListingPropertyValueSelectionDto> PropertyValueSelection { get; set; } = new();

        public List<string> Warnings { get; set; } = new();
    }
}
