namespace Domain.Entities
{
    public class ListingView
    {
        public Guid ListingId { get; set; }
        public Listing Listing { get; set; }

        public Guid ViewerId { get; set; }

        public DateTime ViewedAt { get; set; }
    }
}
