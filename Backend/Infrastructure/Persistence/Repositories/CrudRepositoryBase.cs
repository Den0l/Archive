using Infrastructure.Persistence.Contexts;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Persistence.Repositories
{
    internal abstract class CrudRepositoryBase<TEntity>
        where TEntity : class
    {
        private const string EntityIdPropertyName = "Id";

        protected readonly MarketplaceDbContext dbContext;

        protected CrudRepositoryBase(MarketplaceDbContext dbContext)
        {
            this.dbContext = dbContext;
        }

        protected abstract DbSet<TEntity> Entities { get; }

        protected abstract IQueryable<TEntity> Query();

        protected async Task<TEntity> AddAndSaveAsync(TEntity entity)
        {
            await Entities.AddAsync(entity);
            await dbContext.SaveChangesAsync();
            return entity;
        }

        protected Task<List<TEntity>> GetAllFromQueryAsync()
        {
            return Query().ToListAsync();
        }

        protected Task<TEntity?> GetByIdFromQueryAsync(Guid id)
        {
            return Query().FirstOrDefaultAsync(
                entity => EF.Property<Guid>(entity, EntityIdPropertyName) == id
            );
        }

        protected async Task<TEntity?> DeleteByIdAsync(Guid id)
        {
            var existing = await GetByIdFromQueryAsync(id);
            if (existing == null)
            {
                return null;
            }

            Entities.Remove(existing);
            await dbContext.SaveChangesAsync();
            return existing;
        }
    }
}
