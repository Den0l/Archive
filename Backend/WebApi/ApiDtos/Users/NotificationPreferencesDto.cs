namespace WebApi.ApiDtos.Users
{
    public class NotificationPreferencesDto
    {
        public bool NotifyEmailOnNewMessage { get; set; }
        public bool NotifyEmailOnSellerOrder { get; set; }
        public bool NotifyEmailOnFollowedSellerListing { get; set; }
        public bool NotifyEmailOnLogin { get; set; }
    }
}
