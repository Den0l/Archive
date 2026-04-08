using System.ComponentModel.DataAnnotations;
using WebApi.Validation;

namespace WebApi.ApiDtos.Categories
{
    public class CreateCategoryRequest
    {
        [Required]
        [StringLength(80, MinimumLength = 2)]
        public string Name { get; set; }

        [NotEmptyGuid]
        public Guid? ParentCategoryId { get; set; }
    }
}
