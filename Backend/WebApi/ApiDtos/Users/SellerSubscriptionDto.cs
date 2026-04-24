namespace WebApi.ApiDtos.Users
{
    public class SellerSubscriptionDto
    {
        public Guid SellerId { get; set; }
        public string SellerNickname { get; set; } = string.Empty;
        public DateTime SubscribedAt { get; set; }
    }
}
