using System.ComponentModel.DataAnnotations;

namespace WebApi.ApiDtos.Users
{
    public class RequestEmailChangeRequest
    {
        [Required]
        [EmailAddress]
        [StringLength(254)]
        public string NewEmail { get; set; } = string.Empty;
    }
}
