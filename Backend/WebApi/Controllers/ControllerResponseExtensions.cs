using AutoMapper;
using Microsoft.AspNetCore.Mvc;

namespace WebApi.Controllers
{
    internal static class ControllerResponseExtensions
    {
        public static IActionResult OkMapped<TDestination>(
            this ControllerBase controller,
            IMapper mapper,
            object source
        )
        {
            return controller.Ok(mapper.Map<TDestination>(source));
        }

        public static IActionResult OkMappedOrNotFound<TSource, TDestination>(
            this ControllerBase controller,
            IMapper mapper,
            TSource? source
        )
            where TSource : class
        {
            if (source == null)
            {
                return controller.NotFound();
            }

            return controller.Ok(mapper.Map<TDestination>(source));
        }
    }
}
