using System.ComponentModel.DataAnnotations;

namespace WebApi.ApiDtos.ListingPropertyValues
{
    public class CreatePropertyValueInsidePropertyRequest
    {
        [Required]
        [StringLength(80, MinimumLength = 2)]
        public string Name { get; set; }
    }
}
