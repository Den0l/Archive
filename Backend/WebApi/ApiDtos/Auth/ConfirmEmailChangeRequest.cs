using System.ComponentModel.DataAnnotations;

namespace WebApi.ApiDtos.Auth
{
    public class ConfirmEmailChangeRequest
    {
        [Required]
        public Guid UserId { get; set; }

        [Required]
        [EmailAddress]
        [StringLength(254)]
        public string NewEmail { get; set; } = string.Empty;

        [Required]
        public string Token { get; set; } = string.Empty;
    }
}
