using System.ComponentModel.DataAnnotations;

namespace WebApi.Validation
{
    [AttributeUsage(AttributeTargets.Property | AttributeTargets.Field | AttributeTargets.Parameter)]
    public sealed class NotEmptyGuidAttribute : ValidationAttribute
    {
        public NotEmptyGuidAttribute()
            : base("The {0} field must contain a non-empty identifier.")
        {
        }

        public override bool IsValid(object? value)
        {
            if (value is null)
            {
                return true;
            }

            if (value is Guid guid)
            {
                return guid != Guid.Empty;
            }

            return false;
        }
    }
}
