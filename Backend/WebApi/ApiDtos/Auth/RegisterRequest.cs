using System.ComponentModel.DataAnnotations;

namespace WebApi.ApiDtos.Auth
{
    public class RegisterRequest
    {
        [Required]
        [EmailAddress]
        [StringLength(254)]
        public string Username { get; set; }

        [Required]
        [StringLength(50, MinimumLength = 2)]
        public string Nickname { get; set; }

        [Required]
        [StringLength(128, MinimumLength = 6)]
        public string Password { get; set; }
    }
}
