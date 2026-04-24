using AutoMapper;
using Infrastructure.FileStorage.Interfaces;
using Infrastructure.ImageProcessing.Interfaces;
using Microsoft.AspNetCore.Mvc;
using WebApi.ApiDtos.Images;
using WebApi.Validation;

namespace WebApi.Controllers
{
    /// <summary>
    /// Controller for managing image operations such as retrieving, uploading, deleting,
    /// and processing images.
    /// </summary>
    [Route("api/[controller]")]
    [ApiController]
    public class ImagesController : ControllerBase
    {
        private readonly IImageRepository repository;
        private readonly IBackgroundRemovalService backgroundRemovalService;
        private readonly ILogger<ImagesController> logger;
        private readonly IMapper mapper;

        /// <summary>
        /// Initializes a new instance of ImagesController
        /// </summary>
        public ImagesController(
            IImageRepository repository,
            IBackgroundRemovalService backgroundRemovalService,
            ILogger<ImagesController> logger,
            IMapper mapper)
        {
            this.repository = repository;
            this.backgroundRemovalService = backgroundRemovalService;
            this.logger = logger;
            this.mapper = mapper;
        }

        /// <summary>
        /// Retrieves all images.
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var domain = await repository.GetAllAsync();
            return Ok(mapper.Map<List<ImageDto>>(domain));
        }

        /// <summary>
        /// Retrieves an image by its ID.
        /// </summary>
        [HttpGet]
        [Route("{id:Guid}")]
        public async Task<IActionResult> GetById(Guid id)
        {
            var domain = await repository.GetByIdAsync(id);
            if (domain == null)
            {
                return NotFound();
            }

            return Ok(mapper.Map<ImageDto>(domain));
        }

        /// <summary>
        /// Deletes an image by its ID.
        /// </summary>
        [HttpDelete]
        [Route("{id:Guid}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var domain = await repository.DeleteAsync(id);
            if (domain == null)
            {
                return NotFound();
            }

            return Ok(mapper.Map<ImageDto>(domain));
        }

        /// <summary>
        /// Uploads a new image.
        /// </summary>
        [HttpPost]
        [Route("Upload")]
        public async Task<IActionResult> Upload([FromForm] AddImageRequest request)
        {
            ValidateFileUpload(request.File);
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var domain = await repository.UploadAsync(request.ListingId, request.File);
                if (domain == null)
                {
                    return NotFound(new
                    {
                        message = "\u041e\u0431\u044a\u044f\u0432\u043b\u0435\u043d\u0438\u0435 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u043e.",
                    });
                }

                return Ok(mapper.Map<ImageDto>(domain));
            }
            catch (InvalidOperationException exception)
            {
                return BadRequest(new
                {
                    message = exception.Message,
                });
            }
        }

        /// <summary>
        /// Removes the background from a new or existing image.
        /// </summary>
        [HttpPost]
        [Route("RemoveBackground")]
        public async Task<IActionResult> RemoveBackground(
            [FromForm] RemoveBackgroundRequest request,
            CancellationToken cancellationToken)
        {
            var hasFile = request.File != null;
            var hasImageId = request.ImageId.HasValue && request.ImageId.Value != Guid.Empty;

            if (hasFile == hasImageId)
            {
                return BadRequest(new
                {
                    message = "\u041f\u0435\u0440\u0435\u0434\u0430\u0439\u0442\u0435 \u043b\u0438\u0431\u043e \u0444\u0430\u0439\u043b, \u043b\u0438\u0431\u043e imageId.",
                });
            }

            try
            {
                byte[] sourceImage;

                if (hasFile)
                {
                    var file = request.File!;
                    var validationError = ImageUploadValidation.ValidateFile(
                        file.FileName,
                        file.Length,
                        file.ContentType);
                    if (validationError != null)
                    {
                        return BadRequest(new { message = validationError });
                    }

                    await using var inputStream = file.OpenReadStream();
                    await using var memoryStream = new MemoryStream();
                    await inputStream.CopyToAsync(memoryStream, cancellationToken);
                    sourceImage = memoryStream.ToArray();
                }
                else
                {
                    var storedImage = await repository.GetStoredFileAsync(
                        request.ImageId!.Value,
                        cancellationToken);
                    if (storedImage == null)
                    {
                        return NotFound(new
                        {
                            message = "\u0418\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u0435 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u043e.",
                        });
                    }

                    var validationError = ImageUploadValidation.ValidateFile(
                        $"{storedImage.Image.FileName}{storedImage.Image.FileExtension}",
                        storedImage.Image.FileSizeInBytes);
                    if (validationError != null)
                    {
                        return BadRequest(new { message = validationError });
                    }

                    sourceImage = storedImage.Content;
                }

                var result = await backgroundRemovalService.RemoveBackgroundAsync(
                    sourceImage,
                    cancellationToken);
                return File(result, "image/png");
            }
            catch (Exception exception)
            {
                logger.LogError(
                    exception,
                    "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0443\u0434\u0430\u043b\u0438\u0442\u044c \u0444\u043e\u043d \u0441 \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u044f. SourceType={SourceType}",
                    hasFile ? "file" : "imageId");

                return StatusCode(StatusCodes.Status500InternalServerError, new
                {
                    message = "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0443\u0431\u0440\u0430\u0442\u044c \u0444\u043e\u043d \u0441 \u0444\u043e\u0442\u043e\u0433\u0440\u0430\u0444\u0438\u0438.",
                });
            }
        }

        /// <summary>
        /// Validates the uploaded file.
        /// </summary>
        private void ValidateFileUpload(IFormFile file)
        {
            var validationError = ImageUploadValidation.ValidateFile(
                file.FileName,
                file.Length,
                file.ContentType);
            if (validationError == null)
            {
                return;
            }

            ModelState.AddModelError("file", validationError);
        }
    }
}
