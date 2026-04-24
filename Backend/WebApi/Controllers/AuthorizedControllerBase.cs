using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace WebApi.Controllers
{
    public abstract class AuthorizedControllerBase : ControllerBase
    {
        protected bool TryGetAuthenticatedUserId(out Guid userId)
        {
            userId = Guid.Empty;
            var userIdString = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return !string.IsNullOrWhiteSpace(userIdString) &&
                Guid.TryParse(userIdString, out userId);
        }

        protected IActionResult? UnauthorizedIfNoAuthenticatedUserId(
            out Guid userId
        )
        {
            if (TryGetAuthenticatedUserId(out userId))
            {
                return null;
            }

            return Unauthorized();
        }

        protected IActionResult? ForbidIf(bool shouldForbid)
        {
            if (!shouldForbid)
            {
                return null;
            }

            return Forbid();
        }

        protected IActionResult? NotFoundIfNull<T>(
            T? entity,
            string? message = null
        )
            where T : class
        {
            if (entity != null)
            {
                return null;
            }

            return string.IsNullOrWhiteSpace(message)
                ? NotFound()
                : NotFound(message);
        }
    }
}
