using Application.Filters;
using Application.Interfaces;
using Application.Interfaces.Repositories;
using AutoMapper;
using Domain.Entities;
using Infrastructure.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using WebApi.ApiDtos;
using WebApi.ApiDtos.ListingPropertyValues;
using WebApi.ApiDtos.Listings;
using WebApi.Services;

namespace WebApi.Controllers
{
    /// <summary>
    /// Manages the listings, including retrieval, creation, updating, and deletion of listings.
    /// </summary>
    [Route("api/[controller]")]
    [ApiController]
    public class ListingsController : AuthorizedControllerBase
    {
        private readonly IListingRepository repository;
        private readonly UserManager<ApplicationUser> userManager;
        private readonly IMapper mapper;
        private readonly IListingAiAutofillService listingAiAutofillService;
        private readonly ISellerSubscriptionRepository sellerSubscriptionRepository;
        private readonly IBackgroundNotificationQueue backgroundNotificationQueue;
        private readonly ILogger<ListingsController> logger;
        private readonly Infrastructure.Persistence.Contexts.MarketplaceDbContext dbContext;

        /// <summary>
        /// Initializes a new instance of ListingsController
        /// </summary>
        /// <param name="repository">The repository for interacting with listing data.</param>
        /// <param name="mapper">Mapper instance to handle mapping between domain models and DTOs.</param>
        public ListingsController(
            IListingRepository repository,
            UserManager<ApplicationUser> userManager,
            IMapper mapper,
            IListingAiAutofillService listingAiAutofillService,
            ISellerSubscriptionRepository sellerSubscriptionRepository,
            IBackgroundNotificationQueue backgroundNotificationQueue,
            ILogger<ListingsController> logger,
            Infrastructure.Persistence.Contexts.MarketplaceDbContext dbContext)
        {
            this.repository = repository;
            this.userManager = userManager;
            this.mapper = mapper;
            this.listingAiAutofillService = listingAiAutofillService;
            this.sellerSubscriptionRepository = sellerSubscriptionRepository;
            this.backgroundNotificationQueue = backgroundNotificationQueue;
            this.logger = logger;
            this.dbContext = dbContext;
        }

        /// <summary>
        /// Retrieves all listings. I am using post, because with get a cannot pass a filter in the body of request. 
        /// </summary>
        /// <returns>A list of all listings.</returns>
        [HttpPost]
        [Route("GetAll")]
        public async Task<IActionResult> GetAll([FromBody] ListingFilterDto filter, [FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 12)
        {
            var filterDomain = mapper.Map<ListingFilter>(filter);
            var pagedDomain = await repository.GetAllAsync(filterDomain, pageNumber, pageSize);
            return Ok(pagedDomain.ToDto<Listing, ListingDto>(mapper));
        }

        /// <summary>
        /// Retrieves a listing by its unique ID.
        /// </summary>
        /// <param name="id">The unique identifier of the listing.</param>
        /// <returns>The requested listing, or NotFound if the listing does not exist.</returns>
        [HttpGet]
        [Route("{id:Guid}")]
        public async Task<IActionResult> GetById(Guid id)
        {
            var domain = await repository.GetByIdAsync(id);
            var notFoundResult = NotFoundIfNull(domain);
            if (notFoundResult != null)
            {
                return notFoundResult;
            }

            if (TryGetAuthenticatedUserId(out var currentUserId))
            {
                var hasViewedAlready = await dbContext.ListingViews.AnyAsync(
                    listingView =>
                        listingView.ListingId == id &&
                        listingView.ViewerId == currentUserId);

                if (!hasViewedAlready)
                {
                    try
                    {
                        dbContext.ListingViews.Add(new ListingView
                        {
                            ListingId = id,
                            ViewerId = currentUserId,
                            ViewedAt = DateTime.Now
                        });
                        await dbContext.SaveChangesAsync();

                        domain.ViewCount++;
                        await dbContext.SaveChangesAsync();
                    }
                    catch (DbUpdateException)
                    {
                        // Another concurrent request has already saved this view.
                    }
                }
            }
            else
            {
                var viewerFingerprint = BuildGuestViewerFingerprint();
                if (!string.IsNullOrWhiteSpace(viewerFingerprint))
                {
                    var hasViewedAlready = await dbContext.ListingGuestViews.AnyAsync(
                        listingGuestView =>
                            listingGuestView.ListingId == id &&
                            listingGuestView.ViewerFingerprint == viewerFingerprint);

                    if (!hasViewedAlready)
                    {
                        try
                        {
                            dbContext.ListingGuestViews.Add(new ListingGuestView
                            {
                                ListingId = id,
                                ViewerFingerprint = viewerFingerprint,
                                ViewedAt = DateTime.Now
                            });
                            await dbContext.SaveChangesAsync();

                            domain.ViewCount++;
                            await dbContext.SaveChangesAsync();
                        }
                        catch (DbUpdateException)
                        {
                            // Another concurrent request has already saved this guest view.
                        }
                    }
                }
            }

            return Ok(mapper.Map<ListingDetailDto>(domain));
        }

        [HttpGet]
        [Route("{id:Guid}/stats")]
        [Authorize]
        public async Task<IActionResult> GetStats(Guid id)
        {
            var domain = await repository.GetByIdAsync(id);
            var notFoundResult = NotFoundIfNull(domain);
            if (notFoundResult != null)
            {
                return notFoundResult;
            }

            var unauthorizedResult = UnauthorizedIfNoAuthenticatedUserId(
                out var userId
            );
            if (unauthorizedResult != null)
            {
                return unauthorizedResult;
            }

            var forbidResult = ForbidIf(domain.SellerId != userId);
            if (forbidResult != null)
            {
                return forbidResult;
            }

            var favoriteCount = await dbContext.FavoriteItems.CountAsync(fi => fi.ListingId == id);
            var cartCount = await dbContext.CartItems.CountAsync(ci => ci.ListingId == id);

            return Ok(new ListingStatsDto
            {
                ViewCount = domain.ViewCount,
                FavoriteCount = favoriteCount,
                CartCount = cartCount
            });
        }
        [HttpPost]
        [Route("StatsBatch")]
        [Authorize]
        public async Task<IActionResult> GetStatsBatch([FromBody] List<Guid> listingIds)
        {
            if (listingIds == null || listingIds.Count == 0)
                return Ok(new Dictionary<Guid, ListingStatsDto>());

            var unauthorizedResult = UnauthorizedIfNoAuthenticatedUserId(
                out var userId
            );
            if (unauthorizedResult != null)
            {
                return unauthorizedResult;
            }

            var listings = await dbContext.Listings
                .Where(l => listingIds.Contains(l.Id) && l.SellerId == userId)
                .Select(l => new { l.Id, l.ViewCount })
                .ToListAsync();

            if (listings.Count == 0)
                return Ok(new Dictionary<Guid, ListingStatsDto>());

            var ownedIds = listings.Select(l => l.Id).ToList();

            var favoriteCounts = await dbContext.FavoriteItems
                .Where(fi => ownedIds.Contains(fi.ListingId))
                .GroupBy(fi => fi.ListingId)
                .Select(g => new { ListingId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.ListingId, x => x.Count);

            var cartCounts = await dbContext.CartItems
                .Where(ci => ownedIds.Contains(ci.ListingId))
                .GroupBy(ci => ci.ListingId)
                .Select(g => new { ListingId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.ListingId, x => x.Count);

            var result = listings.ToDictionary(
                l => l.Id,
                l => new ListingStatsDto
                {
                    ViewCount = l.ViewCount,
                    FavoriteCount = favoriteCounts.GetValueOrDefault(l.Id, 0),
                    CartCount = cartCounts.GetValueOrDefault(l.Id, 0)
                });

            return Ok(result);
        }

        /// <summary>
        /// User to get the listings owned by the user, that is signed in.
        /// </summary>
        /// <returns></returns>
        [Authorize]
        [HttpGet]
        [Route("GetByUser")]
        [Authorize]
        public async Task<IActionResult> GetAllByUser()
        {
            var unauthorizedResult = UnauthorizedIfNoAuthenticatedUserId(
                out var userId
            );
            if (unauthorizedResult != null)
            {
                return unauthorizedResult;
            }

            var filter = new ListingFilter() { SellerId = userId};
            var domain = await repository.GetAllAsync(filter, 1, int.MaxValue);
            return Ok(mapper.Map<List<ListingDto>>(domain.Items));
        }
        /// <summary>
        /// Creates a new listing.
        /// </summary>
        /// <param name="request">The request object containing details of the listing to create.</param>
        /// <returns>The created listing.</returns>
        [Authorize]
        [HttpPost]
        public async Task<IActionResult> Post(CreateListingRequest request)
        {
            var domain = mapper.Map<Listing>(request);
            var unauthorizedResult = UnauthorizedIfNoAuthenticatedUserId(
                out var userId
            );
            if (unauthorizedResult != null)
            {
                return unauthorizedResult;
            }

            domain.SellerId = userId;
            domain.CreatedAt = DateTime.Now;
            List<IListingPropertyValueSelection> interfaceListSelections = request.PropertyValueSelection.Cast<IListingPropertyValueSelection>().ToList();
            domain = await repository.CreateAsync(domain, interfaceListSelections);
            if (domain == null)
                return BadRequest("Invalid listing data or property values.");

            var subscriberIds = await sellerSubscriptionRepository.GetSubscriberIdsBySellerIdAsync(userId);
            if (subscriberIds.Count > 0)
            {
                var seller = await userManager.FindByIdAsync(userId.ToString());
                var subscribers = await userManager.Users
                    .Where(user =>
                        subscriberIds.Contains(user.Id) &&
                        user.NotifyEmailOnFollowedSellerListing &&
                        user.Email != null)
                    .ToListAsync();

                foreach (var subscriber in subscribers)
                {
                    var sellerName = seller?.Nickname ?? "Продавец";
                    var subscriberEmail = subscriber.Email!;
                    var subscriberNickname = subscriber.Nickname;
                    var listingTitle = domain.Title;
                    var listingId = domain.Id;

                    await backgroundNotificationQueue.QueueAsync(
                        (notificationEmailService, cancellationToken) =>
                            notificationEmailService
                                .SendFollowedSellerListingNotificationAsync(
                                    subscriberEmail,
                                    subscriberNickname,
                                    sellerName,
                                    listingTitle,
                                    listingId));
                }
            }

            return Ok(mapper.Map<ListingDto>(domain));
        }

        [Authorize]
        [HttpPost("AiAutofill")]
        public async Task<IActionResult> AiAutofill(
            [FromForm] AiAutofillListingRequest request,
            CancellationToken cancellationToken)
        {
            if (request.ListingId.HasValue)
            {
                var forbidResult = ForbidIf(
                    !await UserOwnsTheListing(request.ListingId.Value)
                );
                if (forbidResult != null)
                {
                    return forbidResult;
                }
            }

            try
            {
                var response = await listingAiAutofillService.AutofillAsync(
                    new ListingAiAutofillInput
                    {
                        ListingId = request.ListingId,
                        DescriptionHint = request.DescriptionHint,
                        ExistingImageIds = request.ExistingImageIds,
                        NewImages = request.NewImages,
                    },
                    cancellationToken);

                return Ok(response);
            }
            catch (ListingAiAutofillException exception)
            {
                return StatusCode(exception.StatusCode, new
                {
                    message = exception.Message,
                });
            }
            catch (Exception exception)
            {
                logger.LogError(
                    exception,
                    "Не удалось выполнить AI-автозаполнение объявления. ListingId={ListingId}",
                    request.ListingId);

                return StatusCode(StatusCodes.Status500InternalServerError, new
                {
                    message = "Не удалось выполнить AI-анализ фотографий.",
                });
            }
        }

        /// <summary>
        /// Updates an existing listing by its ID.
        /// </summary>
        /// <param name="id">The unique identifier of the listing to update.</param>
        /// <param name="request">The request object containing updated listing details.</param>
        /// <returns>The updated listing, or NotFound if the listing does not exist.</returns>
        [Authorize]
        [HttpPut("{id:Guid}")]
        public async Task<IActionResult> Put(Guid id, UpdateListingRequest request)
        {
            var forbidResult = ForbidIf(!await UserOwnsTheListing(id));
            if (forbidResult != null)
            {
                return forbidResult;
            }
            var domain = mapper.Map<Listing>(request);
            List<IListingPropertyValueSelection> interfaceListSelections = request.PropertyValueSelection
                .Cast<IListingPropertyValueSelection>()
                .ToList();
            domain = await repository.UpdateAsync(id, domain, interfaceListSelections);
            var notFoundResult = NotFoundIfNull(domain);
            if (notFoundResult != null)
            {
                return notFoundResult;
            }
            return Ok(mapper.Map<ListingDto>(domain));
        }

        [Authorize]
        [HttpPatch("{id:Guid}/archive")]
        public async Task<IActionResult> PatchArchive(
            Guid id,
            UpdateListingArchiveRequest request)
        {
            var forbidResult = ForbidIf(!await UserOwnsTheListing(id));
            if (forbidResult != null)
            {
                return forbidResult;
            }

            var listing = await dbContext.Listings
                .Include(x => x.Images)
                .FirstOrDefaultAsync(x => x.Id == id);
            var notFoundResult = NotFoundIfNull(listing);
            if (notFoundResult != null)
            {
                return notFoundResult;
            }

            listing.IsArchived = request.IsArchived;
            await dbContext.SaveChangesAsync();

            return Ok(mapper.Map<ListingDto>(listing));
        }

        /// <summary>
        /// Deletes a listing by its ID.
        /// </summary>
        /// <param name="id">The unique identifier of the listing to delete.</param>
        /// <returns>The deleted listing, or NotFound if the listing does not exist.</returns>
        [HttpDelete]
        [Authorize]
        [Route("{id:Guid}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var userOwnsListing = await UserOwnsTheListing(id);
            var userIsAdmin = await UserIsAdmin();
            var forbidResult = ForbidIf(!userOwnsListing && !userIsAdmin);
            if (forbidResult != null)
            {
                return forbidResult;
            }

            var actorIdParsed = TryGetAuthenticatedUserId(out var actorId);
            var domain = await repository.DeleteAsync(id);
            var notFoundResult = NotFoundIfNull(domain);
            if (notFoundResult != null)
            {
                return notFoundResult;
            }

            var removedByAnotherAdmin =
                userIsAdmin &&
                actorIdParsed &&
                actorId != domain.SellerId;

            if (removedByAnotherAdmin)
            {
                var seller = await userManager.FindByIdAsync(domain.SellerId.ToString());
                if (!string.IsNullOrWhiteSpace(seller?.Email))
                {
                    string? adminName = null;
                    if (actorIdParsed)
                    {
                        var admin = await userManager.FindByIdAsync(actorId.ToString());
                        adminName = admin?.Nickname;
                    }

                    var sellerEmail = seller.Email!;
                    var sellerName = seller.Nickname;
                    var listingTitle = domain.Title;
                    var listingId = domain.Id;

                    await backgroundNotificationQueue.QueueAsync(
                        (notificationEmailService, cancellationToken) =>
                            notificationEmailService
                                .SendListingRemovedByAdminNotificationAsync(
                                    sellerEmail,
                                    sellerName,
                                    listingTitle,
                                    listingId,
                                    adminName));
                }
            }

            return Ok(mapper.Map<ListingDto>(domain));
        }
        private async Task<bool> UserOwnsTheListing(Guid id) {
            var domain = await repository.GetByIdAsync(id);
            if (domain == null)
            {
                return false;
            }

            if (!TryGetAuthenticatedUserId(out var userId))
            {
                return false;
            }

            return domain.SellerId == userId;
        }
        private async Task<bool> UserIsAdmin()
        {
            if (!TryGetAuthenticatedUserId(out var userId))
            {
                return false;
            }

            var user = await userManager.FindByIdAsync(userId.ToString());
            if (user == null)
            {
                return false;
            }

            var roles = await userManager.GetRolesAsync(user);
            return roles.Contains("Admin");
        }

        private string BuildGuestViewerFingerprint()
        {
            var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
            var userAgent = Request.Headers.UserAgent.ToString();
            var source = $"{ipAddress}|{userAgent}".Trim().ToLowerInvariant();

            if (string.IsNullOrWhiteSpace(source) || source == "|")
            {
                return string.Empty;
            }

            var bytes = Encoding.UTF8.GetBytes(source);
            var hashBytes = SHA256.HashData(bytes);
            return Convert.ToHexString(hashBytes);
        }
    }
}
