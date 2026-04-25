using Application.Pagination;
using AutoMapper;

namespace WebApi.ApiDtos
{
    public static class PageDtoExtensions
    {
        /// <summary>
        /// Maps a domain <see cref="Page{TSource}"/> into a transport <see cref="PageDto{TDto}"/>
        /// using the supplied AutoMapper instance for item-level mapping.
        /// </summary>
        public static PageDto<TDto> ToDto<TSource, TDto>(this Page<TSource> page, IMapper mapper) =>
            new()
            {
                Items = mapper.Map<List<TDto>>(page.Items),
                TotalPages = page.TotalPages,
                PageNumber = page.PageNumber,
                PageSize = page.PageSize,
            };
    }
}
