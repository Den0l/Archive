using Infrastructure.FileStorage.Interfaces;
using Microsoft.AspNetCore.Http;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Jpeg;
using WebApi.Validation;
using ImageSharpImage = SixLabors.ImageSharp.Image;

namespace WebApi.Services.ListingAi
{
    internal sealed class AiImagePreparer
    {
        private readonly IImageRepository imageRepository;

        public AiImagePreparer(IImageRepository imageRepository)
        {
            this.imageRepository = imageRepository;
        }

        public async Task<List<AiImagePayload>> LoadAsync(
            ListingAiAutofillInput input,
            CancellationToken cancellationToken)
        {
            var images = new List<AiImagePayload>();

            foreach (var imageId in input.ExistingImageIds.Distinct())
            {
                var storedImage = await imageRepository.GetStoredFileAsync(
                    imageId,
                    cancellationToken);
                if (storedImage == null)
                {
                    throw new ListingAiAutofillException(
                        StatusCodes.Status400BadRequest,
                        "Одно из выбранных фото не найдено.");
                }

                if (input.ListingId.HasValue &&
                    storedImage.Image.ListingId != input.ListingId.Value)
                {
                    throw new ListingAiAutofillException(
                        StatusCodes.Status403Forbidden,
                        "Нельзя анализировать фото, не принадлежащее объявлению.");
                }

                var fileName =
                    $"{storedImage.Image.FileName}{storedImage.Image.FileExtension}";
                var validationError = ImageUploadValidation.ValidateFile(
                    fileName,
                    storedImage.Image.FileSizeInBytes);
                if (validationError != null)
                {
                    throw new ListingAiAutofillException(
                        StatusCodes.Status400BadRequest,
                        validationError);
                }

                images.Add(await ConvertToAiCompatibleImageAsync(
                    fileName,
                    storedImage.Content,
                    cancellationToken));
            }

            foreach (var newImage in input.NewImages)
            {
                var validationError = ImageUploadValidation.ValidateFile(
                    newImage.FileName,
                    newImage.Length,
                    newImage.ContentType);
                if (validationError != null)
                {
                    throw new ListingAiAutofillException(
                        StatusCodes.Status400BadRequest,
                        validationError);
                }

                await using var inputStream = newImage.OpenReadStream();
                await using var memoryStream = new MemoryStream();
                await inputStream.CopyToAsync(memoryStream, cancellationToken);

                images.Add(await ConvertToAiCompatibleImageAsync(
                    newImage.FileName,
                    memoryStream.ToArray(),
                    cancellationToken));
            }

            return images;
        }

        private static async Task<AiImagePayload> ConvertToAiCompatibleImageAsync(
            string fileName,
            byte[] content,
            CancellationToken cancellationToken)
        {
            try
            {
                await using var inputStream = new MemoryStream(content);
                using var image = await ImageSharpImage.LoadAsync(inputStream, cancellationToken);
                await using var outputStream = new MemoryStream();

                await image.SaveAsJpegAsync(
                    outputStream,
                    new JpegEncoder
                    {
                        Quality = 90,
                    },
                    cancellationToken);

                var aiFileName = Path.ChangeExtension(fileName, ".jpg");

                return new AiImagePayload(
                    aiFileName,
                    "image/jpeg",
                    outputStream.ToArray());
            }
            catch (UnknownImageFormatException)
            {
                throw new ListingAiAutofillException(
                    StatusCodes.Status400BadRequest,
                    "Не удалось подготовить одно из изображений для AI-анализа. Используйте JPG, JPEG, PNG, WEBP; если файл в HEIF/HEIC не распознаётся, конвертируйте его в JPG.");
            }
            catch (InvalidImageContentException)
            {
                throw new ListingAiAutofillException(
                    StatusCodes.Status400BadRequest,
                    "Одно из изображений повреждено или имеет неподдерживаемый формат для AI-анализа.");
            }
        }
    }
}
