using Domain.Entities;
using Infrastructure.FileStorage;
using Infrastructure.FileStorage.Interfaces;
using Infrastructure.Persistence.Contexts;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Persistence.Repositories
{
    public class ImageRepository : IImageRepository
    {
        private const int MaxImagesPerListing = 10;
        private static readonly HashSet<string> AllowedImageExtensions = new(
            StringComparer.OrdinalIgnoreCase)
        {
            ".jpg",
            ".jpeg",
            ".jfif",
            ".png",
            ".webp",
            ".heif",
            ".heic",
            ".avif",
            ".gif",
            ".bmp",
        };

        private static readonly Dictionary<string, string> ExtensionByMimeType =
            new(StringComparer.OrdinalIgnoreCase)
            {
                ["image/jpeg"] = ".jpg",
                ["image/jpg"] = ".jpg",
                ["image/pjpeg"] = ".jpg",
                ["image/jfif"] = ".jpg",
                ["image/png"] = ".png",
                ["image/webp"] = ".webp",
                ["image/heif"] = ".heif",
                ["image/heic"] = ".heic",
                ["image/heif-sequence"] = ".heif",
                ["image/heic-sequence"] = ".heic",
                ["image/avif"] = ".avif",
                ["image/gif"] = ".gif",
                ["image/bmp"] = ".bmp",
                ["image/x-ms-bmp"] = ".bmp",
            };

        private readonly IWebHostEnvironment webHostEnvironment;
        private readonly IHttpContextAccessor httpContextAccessor;
        private readonly MarketplaceDbContext dbContext;

        public ImageRepository(
            IWebHostEnvironment webHostEnvironment,
            IHttpContextAccessor httpContextAccessor,
            MarketplaceDbContext dbContext)
        {
            this.webHostEnvironment = webHostEnvironment;
            this.httpContextAccessor = httpContextAccessor;
            this.dbContext = dbContext;
        }

        public async Task SaveImageToFileSystem(Image image, IFormFile file)
        {
            var localFilePath = GetLocalFilePath(image);
            await using var stream = new FileStream(localFilePath, FileMode.Create);
            await file.CopyToAsync(stream);
        }

        public string CreateImageUrl(Image image)
        {
            var scheme = httpContextAccessor.HttpContext?.Request.Scheme ?? "https";
            var host = httpContextAccessor.HttpContext?.Request.Host.ToString() ?? string.Empty;
            var pathBase = httpContextAccessor.HttpContext?.Request.PathBase.ToString() ?? string.Empty;

            return $"{scheme}://{host}{pathBase}/Images/{image.FileName}{image.FileExtension}";
        }

        public async Task<Image?> UploadAsync(Guid listingId, IFormFile file)
        {
            var listing = await dbContext.Listings.FindAsync(listingId);
            if (listing == null)
            {
                return null;
            }

            var existingCount = await CountByListingIdAsync(listingId);
            if (existingCount >= MaxImagesPerListing)
            {
                throw new InvalidOperationException(
                    $"Cannot upload more than {MaxImagesPerListing} images for one listing.");
            }

            var image = new Image
            {
                FileName = $"{Guid.NewGuid()}",
                FileExtension = ResolveFileExtension(file),
                FileSizeInBytes = file.Length,
                ListingId = listingId,
            };

            await SaveImageToFileSystem(image, file);
            image.ImageUrl = CreateImageUrl(image);

            await dbContext.Images.AddAsync(image);
            await dbContext.SaveChangesAsync();

            return image;
        }

        public async Task<int> CountByListingIdAsync(Guid listingId)
        {
            return await dbContext.Images.CountAsync(x => x.ListingId == listingId);
        }

        public void DeleteImageFromFileSystem(Image image)
        {
            var localFilePath = GetLocalFilePath(image);
            File.Delete(localFilePath);
        }

        public async Task<Image?> DeleteAsync(Guid id)
        {
            var existing = await dbContext.Images
                .Include(x => x.Listing)
                .FirstOrDefaultAsync(x => x.Id == id);

            if (existing == null)
            {
                return null;
            }

            DeleteImageFromFileSystem(existing);
            dbContext.Images.Remove(existing);
            await dbContext.SaveChangesAsync();
            return existing;
        }

        public async Task<List<Image>> GetAllAsync()
        {
            return await dbContext.Images
                .Include(x => x.Listing)
                .ToListAsync();
        }

        public async Task<Image?> GetByIdAsync(Guid id)
        {
            return await dbContext.Images
                .Include(x => x.Listing)
                .FirstOrDefaultAsync(x => x.Id == id);
        }

        public async Task<StoredImageFile?> GetStoredFileAsync(
            Guid id,
            CancellationToken cancellationToken = default)
        {
            var image = await dbContext.Images
                .Include(x => x.Listing)
                .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

            if (image == null)
            {
                return null;
            }

            var localFilePath = GetLocalFilePath(image);
            if (!File.Exists(localFilePath))
            {
                throw new FileNotFoundException(
                    "Файл изображения не найден на диске.",
                    localFilePath);
            }

            var content = await File.ReadAllBytesAsync(localFilePath, cancellationToken);
            return new StoredImageFile(image, localFilePath, content);
        }

        private static string ResolveFileExtension(IFormFile file)
        {
            var extension = Path.GetExtension(file.FileName);
            if (AllowedImageExtensions.Contains(extension))
            {
                return extension.ToLowerInvariant();
            }

            var normalizedContentType = NormalizeContentType(file.ContentType);
            if (!string.IsNullOrWhiteSpace(normalizedContentType) &&
                ExtensionByMimeType.TryGetValue(normalizedContentType, out var mappedExtension))
            {
                return mappedExtension;
            }

            return ".jpg";
        }

        private static string? NormalizeContentType(string? contentType)
        {
            if (string.IsNullOrWhiteSpace(contentType))
            {
                return null;
            }

            var separatorIndex = contentType.IndexOf(';');
            var normalized = separatorIndex >= 0
                ? contentType[..separatorIndex]
                : contentType;

            normalized = normalized.Trim();
            return normalized.Length == 0 ? null : normalized;
        }

        private string GetLocalFilePath(Image image)
        {
            return Path.Combine(
                webHostEnvironment.ContentRootPath,
                "Images",
                $"{image.FileName}{image.FileExtension}");
        }
    }
}
