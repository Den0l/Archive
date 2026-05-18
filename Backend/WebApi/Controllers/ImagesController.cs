using Application.Interfaces.Repositories;
using AutoMapper;
using Infrastructure.FileStorage.Interfaces;
using Infrastructure.ImageProcessing.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Infrastructure.Identity;
using WebApi.ApiDtos.Images;
using WebApi.Validation;

namespace WebApi.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class ImagesController : AuthorizedControllerBase
    {
        private readonly IImageRepository repository;
        private readonly IListingRepository listingRepository;
        private readonly IBackgroundRemovalService backgroundRemovalService;
        private readonly UserManager<ApplicationUser> userManager;
        private readonly ILogger<ImagesController> logger;
        private readonly IMapper mapper;

        public ImagesController(
            IImageRepository repository,
            IListingRepository listingRepository,
            IBackgroundRemovalService backgroundRemovalService,
            UserManager<ApplicationUser> userManager,
            ILogger<ImagesController> logger,
            IMapper mapper)
        {
            this.repository = repository;
            this.listingRepository = listingRepository;
            this.backgroundRemovalService = backgroundRemovalService;
            this.userManager = userManager;
            this.logger = logger;
            this.mapper = mapper;
        }

        [HttpGet]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetAll()
        {
            var domain = await repository.GetAllAsync();
            return Ok(mapper.Map<List<ImageDto>>(domain));
        }

        [HttpGet]
        [Route("{id:Guid}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> GetById(Guid id)
        {
            var domain = await repository.GetByIdAsync(id);
            if (domain == null)
            {
                return NotFound();
            }

            return Ok(mapper.Map<ImageDto>(domain));
        }

        [HttpDelete]
        [Route("{id:Guid}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var image = await repository.GetByIdAsync(id);
            var notFoundResult = NotFoundIfNull(image);
            if (notFoundResult != null)
            {
                return notFoundResult;
            }

            var ownershipResult = await EnsureOwnsListingOrIsAdminAsync(image!.ListingId);
            if (ownershipResult != null)
            {
                return ownershipResult;
            }

            var deleted = await repository.DeleteAsync(id);
            if (deleted == null)
            {
                return NotFound();
            }

            return Ok(mapper.Map<ImageDto>(deleted));
        }

        [HttpPost]
        [Route("Upload")]
        public async Task<IActionResult> Upload([FromForm] AddImageRequest request)
        {
            ValidateFileUpload(request.File);
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            var ownershipResult = await EnsureOwnsListingOrIsAdminAsync(request.ListingId);
            if (ownershipResult != null)
            {
                return ownershipResult;
            }

            try
            {
                var domain = await repository.UploadAsync(request.ListingId, request.File);
                if (domain == null)
                {
                    return NotFound(new { message = "Объявление не найдено." });
                }

                return Ok(mapper.Map<ImageDto>(domain));
            }
            catch (InvalidOperationException exception)
            {
                return BadRequest(new { message = exception.Message });
            }
        }

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
                return BadRequest(new { message = "Передайте либо файл, либо imageId." });
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
                        return NotFound(new { message = "Изображение не найдено." });
                    }

                    var ownershipResult = await EnsureOwnsListingOrIsAdminAsync(
                        storedImage.Image.ListingId);
                    if (ownershipResult != null)
                    {
                        return ownershipResult;
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
                    "Не удалось удалить фон с изображения. SourceType={SourceType}",
                    hasFile ? "file" : "imageId");

                return StatusCode(StatusCodes.Status500InternalServerError, new
                {
                    message = "Не удалось убрать фон с фотографии.",
                });
            }
        }

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

        private async Task<IActionResult?> EnsureOwnsListingOrIsAdminAsync(Guid listingId)
        {
            if (!TryGetAuthenticatedUserId(out var userId))
            {
                return Unauthorized();
            }

            var listing = await listingRepository.GetByIdAsync(listingId);
            if (listing == null)
            {
                return NotFound(new { message = "Объявление не найдено." });
            }

            if (listing.SellerId == userId)
            {
                return null;
            }

            var user = await userManager.FindByIdAsync(userId.ToString());
            if (user != null && await userManager.IsInRoleAsync(user, "Admin"))
            {
                return null;
            }

            return Forbid();
        }
    }
}
