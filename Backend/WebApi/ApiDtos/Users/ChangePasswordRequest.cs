using System.ComponentModel.DataAnnotations;

namespace WebApi.ApiDtos.Users
{
    public class ChangePasswordRequest
    {
        [Required]
        [StringLength(128, MinimumLength = 6)]
        public string CurrentPassword { get; set; } = string.Empty;

        [Required]
        [StringLength(128, MinimumLength = 6)]
        public string NewPassword { get; set; } = string.Empty;

        [Required]
        [StringLength(128, MinimumLength = 6)]
        public string ConfirmNewPassword { get; set; } = string.Empty;
    }
}
