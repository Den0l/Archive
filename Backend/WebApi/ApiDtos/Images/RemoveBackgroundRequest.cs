using Microsoft.AspNetCore.Http;

namespace WebApi.ApiDtos.Images
{
    public class RemoveBackgroundRequest
    {
        public IFormFile? File { get; set; }

        public Guid? ImageId { get; set; }
    }
}
