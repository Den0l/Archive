using System.ComponentModel.DataAnnotations;

namespace WebApi.ApiDtos.Users
{
    public class ConfirmEmailCodeRequest
    {
        [Required]
        [StringLength(20, MinimumLength = 4)]
        public string Code { get; set; } = string.Empty;
    }
}
