using Infrastructure.Persistence.Contexts;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Persistence.Repositories
{
    /// <summary>
    /// Base for repositories of entities with a Guid <c>Id</c>.
    /// Subclasses provide the <see cref="Entities"/> DbSet and an optional <see cref="Query"/>
    /// override to attach Includes used by the standard CRUD methods.
    /// </summary>
    public abstract class CrudRepositoryBase<TEntity>
        where TEntity : class
    {
        private const string EntityIdPropertyName = "Id";

        protected readonly MarketplaceDbContext dbContext;

        protected CrudRepositoryBase(MarketplaceDbContext dbContext)
        {
            this.dbContext = dbContext;
        }

        protected abstract DbSet<TEntity> Entities { get; }

        protected virtual IQueryable<TEntity> Query() => Entities;

        public virtual async Task<TEntity> CreateAsync(TEntity entity)
        {
            await Entities.AddAsync(entity);
            await dbContext.SaveChangesAsync();
            return entity;
        }

        public virtual Task<List<TEntity>> GetAllAsync() => Query().ToListAsync();

        public virtual Task<TEntity?> GetByIdAsync(Guid id) =>
            Query().FirstOrDefaultAsync(
                entity => EF.Property<Guid>(entity, EntityIdPropertyName) == id);

        public virtual async Task<TEntity?> DeleteAsync(Guid id)
        {
            var existing = await GetByIdAsync(id);
            if (existing == null)
                return null;

            Entities.Remove(existing);
            await dbContext.SaveChangesAsync();
            return existing;
        }
    }
}
