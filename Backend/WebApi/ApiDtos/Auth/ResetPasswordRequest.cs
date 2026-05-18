using System.ComponentModel.DataAnnotations;

namespace WebApi.ApiDtos.Auth
{
    public class ResetPasswordRequest
    {
        [Required]
        [EmailAddress]
        [StringLength(254)]
        public string Email { get; set; } = string.Empty;

        [Required]
        public string Token { get; set; } = string.Empty;

        [Required]
        [StringLength(128, MinimumLength = 6)]
        public string NewPassword { get; set; } = string.Empty;
    }
}
