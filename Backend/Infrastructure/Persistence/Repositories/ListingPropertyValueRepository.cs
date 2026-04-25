using Application.Interfaces.Repositories;
using Domain.Entities;
using Infrastructure.Persistence.Contexts;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Persistence.Repositories
{
    internal class ListingPropertyValueRepository
        : CrudRepositoryBase<ListingPropertyValue>, IListingPropertyValueRepository
    {
        public ListingPropertyValueRepository(MarketplaceDbContext dbContext)
            : base(dbContext)
        {
        }

        protected override DbSet<ListingPropertyValue> Entities =>
            dbContext.ListingPropertyValues;

        protected override IQueryable<ListingPropertyValue> Query() =>
            dbContext.ListingPropertyValues
                .Include(value => value.ListingProperty)
                .Include(value => value.Listings);

        public async Task<ListingPropertyValue?> UpdateAsync(
            Guid id,
            ListingPropertyValue updatedPropertyValue)
        {
            var existing = await GetByIdAsync(id);
            if (existing == null)
                return null;

            existing.Name = updatedPropertyValue.Name;
            await dbContext.SaveChangesAsync();
            return existing;
        }
    }
}
