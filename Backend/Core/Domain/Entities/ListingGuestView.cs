namespace Domain.Entities
{
    public class ListingGuestView
    {
        public Guid ListingId { get; set; }
        public Listing Listing { get; set; }

        public string ViewerFingerprint { get; set; }

        public DateTime ViewedAt { get; set; }
    }
}
