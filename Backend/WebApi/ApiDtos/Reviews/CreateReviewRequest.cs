using System.ComponentModel.DataAnnotations;
using WebApi.Validation;

namespace WebApi.ApiDtos.Reviews
{
    public class CreateReviewRequest
    {
        [NotEmptyGuid]
        public Guid RevieweeId { get; set; }

        [Required]
        [StringLength(1000, MinimumLength = 10)]
        public string ReviewText { get; set; }
    }
}
