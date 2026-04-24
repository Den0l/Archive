namespace WebApi.ApiDtos.Users
{
    public class UserSettingsDto
    {
        public string Email { get; set; } = string.Empty;
        public string? PendingEmail { get; set; }
        public bool EmailConfirmed { get; set; }
        public NotificationPreferencesDto Notifications { get; set; } = new();
    }
}
