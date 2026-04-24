namespace WebApi.Validation
{
    public static class ImageUploadValidation
    {
        public const long TenMb = 10 * 1024 * 1024;
        public const string AllowedFormatsText = ".jpg, .jpeg, .png, .webp, .heif, .heic";

        private static readonly HashSet<string> AllowedExtensions = new(
            StringComparer.OrdinalIgnoreCase)
        {
            ".jpg",
            ".jpeg",
            ".png",
            ".webp",
            ".heif",
            ".heic",
        };

        private static readonly HashSet<string> AllowedMimeTypes = new(
            StringComparer.OrdinalIgnoreCase)
        {
            "image/jpeg",
            "image/jpg",
            "image/pjpeg",
            "image/png",
            "image/webp",
            "image/heif",
            "image/heic",
            "image/heif-sequence",
            "image/heic-sequence",
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
            if (!AllowedExtensions.Contains(extension))
            {
                return $"Допустимы файлы {AllowedFormatsText}.";
            }

            if (!string.IsNullOrWhiteSpace(contentType) &&
                !AllowedMimeTypes.Contains(contentType))
            {
                return $"Недопустимый тип файла. Используйте {AllowedFormatsText}.";
            }

            if (fileSizeInBytes > TenMb)
            {
                return "Изображение должно быть не больше 10 МБ.";
            }

            return null;
        }
    }
}
