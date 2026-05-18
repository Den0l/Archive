using AutoMapper;
using Domain.Entities;
using Infrastructure.FileStorage;
using Infrastructure.FileStorage.Interfaces;
using Infrastructure.ImageProcessing.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using WebApi.ApiDtos.Images;
using WebApi.Controllers;

namespace Test
{
    public class ImagesControllerTests
    {
        [Fact]
        public async Task RemoveBackground_ReturnsBadRequest_WhenNoSourceIsProvided()
        {
            var controller = CreateController();

            var result = await controller.RemoveBackground(
                new RemoveBackgroundRequest(),
                CancellationToken.None);

            var badRequest = Assert.IsType<BadRequestObjectResult>(result);
            Assert.Equal(StatusCodes.Status400BadRequest, badRequest.StatusCode);
        }

        [Fact]
        public async Task RemoveBackground_ReturnsBadRequest_WhenBothSourcesAreProvided()
        {
            var controller = CreateController();
            var request = new RemoveBackgroundRequest
            {
                File = CreateFormFile("photo.jpg", [1, 2, 3]),
                ImageId = Guid.NewGuid(),
            };

            var result = await controller.RemoveBackground(request, CancellationToken.None);

            var badRequest = Assert.IsType<BadRequestObjectResult>(result);
            Assert.Equal(StatusCodes.Status400BadRequest, badRequest.StatusCode);
        }

        [Fact]
        public async Task RemoveBackground_ReturnsBadRequest_WhenExtensionIsUnsupported()
        {
            var controller = CreateController();
            var request = new RemoveBackgroundRequest
            {
                File = CreateFormFile("photo.txt", [1, 2, 3]),
            };

            var result = await controller.RemoveBackground(request, CancellationToken.None);

            var badRequest = Assert.IsType<BadRequestObjectResult>(result);
            Assert.Equal(StatusCodes.Status400BadRequest, badRequest.StatusCode);
        }

        [Fact]
        public async Task RemoveBackground_ReturnsPng_WhenFileHasNoExtensionButImageMimeType()
        {
            var backgroundRemovalService = new FakeBackgroundRemovalService
            {
                Result = [137, 80, 78, 71],
            };
            var controller = CreateController(
                backgroundRemovalService: backgroundRemovalService);
            var request = new RemoveBackgroundRequest
            {
                File = CreateFormFile("camera_upload", [1, 2, 3], "image/jpeg"),
            };

            var result = await controller.RemoveBackground(request, CancellationToken.None);

            var fileResult = Assert.IsType<FileContentResult>(result);
            Assert.Equal("image/png", fileResult.ContentType);
            Assert.Equal(backgroundRemovalService.Result, fileResult.FileContents);
        }

        [Fact]
        public async Task RemoveBackground_ReturnsBadRequest_WhenFileIsTooLarge()
        {
            var controller = CreateController();
            var request = new RemoveBackgroundRequest
            {
                File = CreateFormFile("photo.jpg", new byte[10 * 1024 * 1024 + 1]),
            };

            var result = await controller.RemoveBackground(request, CancellationToken.None);

            var badRequest = Assert.IsType<BadRequestObjectResult>(result);
            Assert.Equal(StatusCodes.Status400BadRequest, badRequest.StatusCode);
        }

        [Fact]
        public async Task RemoveBackground_ReturnsNotFound_WhenImageIdDoesNotExist()
        {
            var repository = new FakeImageRepository();
            var controller = CreateController(repository);
            var request = new RemoveBackgroundRequest
            {
                ImageId = Guid.NewGuid(),
            };

            var result = await controller.RemoveBackground(request, CancellationToken.None);

            var notFound = Assert.IsType<NotFoundObjectResult>(result);
            Assert.Equal(StatusCodes.Status404NotFound, notFound.StatusCode);
        }

        [Fact]
        public async Task RemoveBackground_ReturnsPng_WhenFileIsValid()
        {
            var backgroundRemovalService = new FakeBackgroundRemovalService
            {
                Result = [137, 80, 78, 71],
            };
            var controller = CreateController(
                backgroundRemovalService: backgroundRemovalService);
            var request = new RemoveBackgroundRequest
            {
                File = CreateFormFile("photo.jpg", [1, 2, 3]),
            };

            var result = await controller.RemoveBackground(request, CancellationToken.None);

            var fileResult = Assert.IsType<FileContentResult>(result);
            Assert.Equal("image/png", fileResult.ContentType);
            Assert.Equal(backgroundRemovalService.Result, fileResult.FileContents);
        }

        [Fact]
        public async Task RemoveBackground_ReturnsServerError_WhenBackgroundRemovalFails()
        {
            var backgroundRemovalService = new FakeBackgroundRemovalService
            {
                ExceptionToThrow = new InvalidOperationException("Rembg is unavailable."),
            };
            var controller = CreateController(
                backgroundRemovalService: backgroundRemovalService);
            var request = new RemoveBackgroundRequest
            {
                File = CreateFormFile("photo.jpg", [1, 2, 3]),
            };

            var result = await controller.RemoveBackground(request, CancellationToken.None);

            var statusResult = Assert.IsType<ObjectResult>(result);
            Assert.Equal(StatusCodes.Status500InternalServerError, statusResult.StatusCode);
        }

        private static ImagesController CreateController(
            IImageRepository? repository = null,
            IBackgroundRemovalService? backgroundRemovalService = null)
        {
            var mapper = new MapperConfiguration(_ => { }).CreateMapper();

            return new ImagesController(
                repository ?? new FakeImageRepository(),
                listingRepository: null!,
                backgroundRemovalService ?? new FakeBackgroundRemovalService(),
                userManager: null!,
                NullLogger<ImagesController>.Instance,
                mapper);
        }

        private static IFormFile CreateFormFile(
            string fileName,
            byte[] content,
            string? contentType = null)
        {
            var stream = new MemoryStream(content);
            return new FormFile(stream, 0, content.Length, "file", fileName)
            {
                Headers = new HeaderDictionary(),
                ContentType = contentType ?? string.Empty,
            };
        }

        private sealed class FakeBackgroundRemovalService : IBackgroundRemovalService
        {
            public byte[] Result { get; set; } = [1, 2, 3];

            public Exception? ExceptionToThrow { get; set; }

            public Task<byte[]> RemoveBackgroundAsync(
                byte[] sourceImage,
                CancellationToken cancellationToken = default)
            {
                if (ExceptionToThrow != null)
                {
                    throw ExceptionToThrow;
                }

                return Task.FromResult(Result);
            }
        }

        private sealed class FakeImageRepository : IImageRepository
        {
            public StoredImageFile? StoredImage { get; set; }

            public Task<Image?> DeleteAsync(Guid id)
            {
                return Task.FromResult<Image?>(null);
            }

            public Task<int> CountByListingIdAsync(Guid listingId)
            {
                return Task.FromResult(0);
            }

            public void DeleteImageFromFileSystem(Image image)
            {
            }

            public Task<List<Image>> GetAllAsync()
            {
                return Task.FromResult(new List<Image>());
            }

            public Task<Image?> GetByIdAsync(Guid id)
            {
                return Task.FromResult<Image?>(null);
            }

            public Task<StoredImageFile?> GetStoredFileAsync(
                Guid id,
                CancellationToken cancellationToken = default)
            {
                return Task.FromResult(StoredImage);
            }

            public Task<Image?> UploadAsync(Guid listingId, IFormFile file)
            {
                return Task.FromResult<Image?>(null);
            }
        }
    }
}
