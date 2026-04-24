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

        protected override IQueryable<ListingPropertyValue> Query()
        {
            return dbContext.ListingPropertyValues
                .Include(value => value.ListingProperty)
                .Include(value => value.Listings);
        }

        public Task<ListingPropertyValue> CreateAsync(ListingPropertyValue value)
        {
            return AddAndSaveAsync(value);
        }

        public Task<List<ListingPropertyValue>> GetAllAsync()
        {
            return GetAllFromQueryAsync();
        }

        public Task<ListingPropertyValue?> GetByIdAsync(Guid id)
        {
            return GetByIdFromQueryAsync(id);
        }

        public Task<ListingPropertyValue?> DeleteAsync(Guid id)
        {
            return DeleteByIdAsync(id);
        }

        public async Task<ListingPropertyValue?> UpdateAsync(
            Guid id,
            ListingPropertyValue updatedPropertyValue
        )
        {
            var existing = await GetByIdFromQueryAsync(id);
            if (existing == null)
            {
                return null;
            }

            existing.Name = updatedPropertyValue.Name;
            await dbContext.SaveChangesAsync();
            return existing;
        }
    }
}
