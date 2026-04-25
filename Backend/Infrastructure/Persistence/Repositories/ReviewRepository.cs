using Application.Interfaces.Repositories;
using Application.Pagination;
using Domain.Entities;
using Infrastructure.Persistence.Contexts;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Persistence.Repositories
{
    public class ReviewRepository : CrudRepositoryBase<Review>, IReviewRepository
    {
        public ReviewRepository(MarketplaceDbContext dbContext) : base(dbContext)
        {
        }

        protected override DbSet<Review> Entities => dbContext.Reviews;

        public override async Task<Review> CreateAsync(Review review)
        {
            if (review.CreatedAt == default)
                review.CreatedAt = DateTime.Now;
            return await base.CreateAsync(review);
        }

        public Task<Page<Review>> GetAllByRevieweeAsync(
            Guid revieweeId, int pageNumber = 1, int pageSize = 20) =>
            dbContext.Reviews
                .Where(r => r.RevieweeId == revieweeId)
                .OrderByDescending(r => r.CreatedAt)
                .ToPageAsync(pageNumber, pageSize);

        public Task<Page<Review>> GetAllByReviewerAsync(
            Guid reviewerId, int pageNumber = 1, int pageSize = 20) =>
            dbContext.Reviews
                .Where(r => r.ReviewerId == reviewerId)
                .OrderByDescending(r => r.CreatedAt)
                .ToPageAsync(pageNumber, pageSize);
    }
}
