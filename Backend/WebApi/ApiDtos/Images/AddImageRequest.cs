using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Http;
using WebApi.Validation;

namespace WebApi.ApiDtos.Images
{
    public class AddImageRequest
    {
        [Required]
        public IFormFile File { get; set; }

        [NotEmptyGuid]
        public Guid ListingId { get; set; }
    }
}
