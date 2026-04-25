using Application.Pagination;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Persistence.Repositories
{
    /// <summary>
    /// EF-aware paging helper. Lives in Infrastructure because <see cref="Application.Pagination.Page{T}"/>
    /// is provider-agnostic but the materialization (Skip/Take/CountAsync) needs EF.
    /// </summary>
    internal static class PaginationExtensions
    {
        public static async Task<Page<T>> ToPageAsync<T>(
            this IQueryable<T> query,
            int pageNumber,
            int pageSize)
        {
            pageNumber = Math.Max(pageNumber, 1);
            pageSize = Math.Max(pageSize, 1);

            var total = await query.CountAsync();
            var items = await query
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return new Page<T>(items, total, pageNumber, pageSize);
        }
    }
}
