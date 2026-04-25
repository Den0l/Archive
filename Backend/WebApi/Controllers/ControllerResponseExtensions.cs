using AutoMapper;
using Microsoft.AspNetCore.Mvc;

namespace WebApi.Controllers
{
    internal static class ControllerResponseExtensions
    {
        /// <summary>
        /// 200 OK with <paramref name="source"/> mapped to <typeparamref name="TDestination"/>.
        /// </summary>
        public static IActionResult OkMapped<TDestination>(
            this ControllerBase controller,
            IMapper mapper,
            object source) =>
            controller.Ok(mapper.Map<TDestination>(source));

        /// <summary>
        /// 200 OK with the mapped DTO, or 404 when <paramref name="source"/> is null.
        /// </summary>
        public static IActionResult OkMappedOrNotFound<TDestination>(
            this ControllerBase controller,
            IMapper mapper,
            object? source) =>
            source == null
                ? controller.NotFound()
                : controller.Ok(mapper.Map<TDestination>(source));
    }
}
