using Domain.Entities;
using Infrastructure.FileStorage;
using Microsoft.AspNetCore.Http;

namespace Infrastructure.FileStorage.Interfaces
{
    /// <summary>
    /// Repository for images. This interface is here, because I dont want to import package, in
    /// which the IFormFile is defined, to the Application project.
    /// </summary>
    public interface IImageRepository
    {
        Task<List<Image>> GetAllAsync();
        Task<Image?> GetByIdAsync(Guid id);
        Task<Image?> UploadAsync(Guid listingId, IFormFile file);
        Task<Image?> DeleteAsync(Guid id);
        Task<int> CountByListingIdAsync(Guid listingId);
        Task<StoredImageFile?> GetStoredFileAsync(
            Guid id,
            CancellationToken cancellationToken = default);
        void DeleteImageFromFileSystem(Image image);
    }
}
