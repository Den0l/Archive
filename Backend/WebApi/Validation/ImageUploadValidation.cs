namespace WebApi.Validation
{
    public static class ImageUploadValidation
    {
        public const long TenMb = 10 * 1024 * 1024;
        public const string AllowedFormatsText =
            ".jpg, .jpeg, .jfif, .png, .webp, .heif, .heic, .avif, .gif, .bmp";

        private static readonly HashSet<string> AllowedExtensions = new(
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

        private static readonly HashSet<string> AllowedMimeTypes = new(
            StringComparer.OrdinalIgnoreCase)
        {
            "image/jpeg",
            "image/jpg",
            "image/pjpeg",
            "image/jfif",
            "image/png",
            "image/webp",
            "image/heif",
            "image/heic",
            "image/heif-sequence",
            "image/heic-sequence",
            "image/avif",
            "image/gif",
            "image/bmp",
            "image/x-ms-bmp",
        };

        private static readonly HashSet<string> AllowedMobileFallbackMimeTypes = new(
            StringComparer.OrdinalIgnoreCase)
        {
            "application/octet-stream",
            "binary/octet-stream",
        };

        public static string? ValidateFile(
            string fileName,
            long fileSizeInBytes,
            string? contentType = null)
        {
            if (string.IsNullOrWhiteSpace(fileName))
            {
                return "Не удалось определить имя файла изображения.";
            }

            if (fileSizeInBytes <= 0)
            {
                return "Файл изображения пустой.";
            }

            var extension = Path.GetExtension(fileName);
            var hasAllowedExtension = AllowedExtensions.Contains(extension);
            var normalizedContentType = NormalizeContentType(contentType);
            var hasAllowedMimeType =
                !string.IsNullOrWhiteSpace(normalizedContentType) &&
                AllowedMimeTypes.Contains(normalizedContentType);
            var hasGenericImageMimeType =
                !string.IsNullOrWhiteSpace(normalizedContentType) &&
                normalizedContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase) &&
                !normalizedContentType.Equals("image/svg+xml", StringComparison.OrdinalIgnoreCase);

            if (!hasAllowedExtension && !hasAllowedMimeType && !hasGenericImageMimeType)
            {
                return $"Допустимы файлы {AllowedFormatsText}.";
            }

            if (!string.IsNullOrWhiteSpace(normalizedContentType) &&
                !hasAllowedMimeType &&
                !AllowedMobileFallbackMimeTypes.Contains(normalizedContentType) &&
                !normalizedContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
            {
                return $"Недопустимый тип файла. Используйте {AllowedFormatsText}.";
            }

            if (fileSizeInBytes > TenMb)
            {
                return "Изображение должно быть не больше 10 МБ.";
            }

            return null;
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
    }
}
