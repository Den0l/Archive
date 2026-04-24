using Application.Interfaces.Repositories;
using AutoMapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WebApi.ApiDtos.Favorites;

namespace WebApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class FavoritesController : AuthorizedControllerBase
    {
        private readonly IFavoriteRepository favoriteRepository;
        private readonly IMapper mapper;

        public FavoritesController(IFavoriteRepository favoriteRepository, IMapper mapper)
        {
            this.favoriteRepository = favoriteRepository;
            this.mapper = mapper;
        }

        [HttpGet]
        public async Task<IActionResult> Get()
        {
            if (!TryGetAuthenticatedUserId(out var userId))
                return Unauthorized();

            var items = await favoriteRepository.GetByUserIdAsync(userId);
            var dtoItems = mapper.Map<List<FavoriteItemDto>>(items);
            return Ok(dtoItems);
        }

        [HttpPost]
        public async Task<IActionResult> Add([FromBody] AddFavoriteRequest request)
        {
            if (request == null || request.ListingId == Guid.Empty)
                return BadRequest("Invalid favorite request.");

            if (!TryGetAuthenticatedUserId(out var userId))
                return Unauthorized();

            var item = await favoriteRepository.AddAsync(userId, request.ListingId);
            if (item == null)
                return NotFound("Listing not found.");

            return Ok(mapper.Map<FavoriteItemDto>(item));
        }

        [HttpDelete("{listingId:Guid}")]
        public async Task<IActionResult> Remove(Guid listingId)
        {
            if (listingId == Guid.Empty)
                return BadRequest("Invalid listing id.");

            if (!TryGetAuthenticatedUserId(out var userId))
                return Unauthorized();

            var removed = await favoriteRepository.RemoveAsync(userId, listingId);
            if (!removed)
                return NotFound();

            return NoContent();
        }

    }
}
