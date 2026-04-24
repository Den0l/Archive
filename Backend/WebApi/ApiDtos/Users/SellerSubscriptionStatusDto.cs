namespace WebApi.ApiDtos.Users
{
    public class SellerSubscriptionStatusDto
    {
        public Guid SellerId { get; set; }
        public bool IsSubscribed { get; set; }
    }
}
