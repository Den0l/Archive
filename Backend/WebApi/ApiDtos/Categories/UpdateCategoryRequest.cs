using System.ComponentModel.DataAnnotations;

namespace WebApi.ApiDtos.Categories
{
    public class UpdateCategoryRequest
    {
        [Required]
        [StringLength(80, MinimumLength = 2)]
        public string Name { get; set; }
    }
}
