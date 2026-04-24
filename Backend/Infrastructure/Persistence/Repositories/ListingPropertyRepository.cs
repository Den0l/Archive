using Application.Interfaces.Repositories;
using Domain.Entities;
using Infrastructure.Persistence.Contexts;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Persistence.Repositories
{
    internal class ListingPropertyRepository
        : CrudRepositoryBase<ListingProperty>, IListingPropertyRepository
    {
        public ListingPropertyRepository(MarketplaceDbContext dbContext)
            : base(dbContext)
        {
        }

        protected override DbSet<ListingProperty> Entities => dbContext.ListingProperties;

        protected override IQueryable<ListingProperty> Query()
        {
            return dbContext.ListingProperties
                .Include(property => property.ListingPropertyValues)
                .Include(property => property.Categories);
        }

        public Task<ListingProperty> CreateAsync(ListingProperty property)
        {
            return AddAndSaveAsync(property);
        }

        public Task<List<ListingProperty>> GetAllAsync()
        {
            return GetAllFromQueryAsync();
        }

        public Task<ListingProperty?> GetByIdAsync(Guid id)
        {
            return GetByIdFromQueryAsync(id);
        }

        public Task<ListingProperty?> DeleteAsync(Guid id)
        {
            return DeleteByIdAsync(id);
        }

        public async Task<ListingProperty?> AddListingPropertyValueAsync(
            Guid id,
            List<ListingPropertyValue> values
        )
        {
            var existing = await GetByIdFromQueryAsync(id);
            if (existing == null)
            {
                return null;
            }

            existing.ListingPropertyValues.AddRange(values);
            await dbContext.SaveChangesAsync();
            return existing;
        }

        public async Task<ListingProperty?> UpdateAsync(
            Guid id,
            ListingProperty updatedProperty
        )
        {
            var existing = await GetByIdFromQueryAsync(id);
            if (existing == null)
            {
                return null;
            }

            existing.Name = updatedProperty.Name;
            await dbContext.SaveChangesAsync();
            return existing;
        }
    }
}
