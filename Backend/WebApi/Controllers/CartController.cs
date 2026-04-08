using Application.Interfaces.Repositories;
using AutoMapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using WebApi.ApiDtos.Cart;

namespace WebApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class CartController : ControllerBase
    {
        private readonly ICartRepository cartRepository;
        private readonly IMapper mapper;

        public CartController(ICartRepository cartRepository, IMapper mapper)
        {
            this.cartRepository = cartRepository;
            this.mapper = mapper;
        }

        [HttpGet]
        public async Task<IActionResult> Get()
        {
            if (!TryGetUserId(out var userId))
                return Unauthorized();

            var items = await cartRepository.GetByUserIdAsync(userId);
            var dtoItems = mapper.Map<List<CartItemDto>>(items);
            var totalItems = dtoItems.Sum(i => i.Quantity);
            var totalPrice = dtoItems.Sum(i => i.Quantity * i.Listing.Price);

            var dto = new CartDto
            {
                Items = dtoItems,
                TotalItems = totalItems,
                TotalPrice = totalPrice
            };

            return Ok(dto);
        }

        [HttpPost("items")]
        public async Task<IActionResult> AddItem([FromBody] AddCartItemRequest request)
        {
            if (request == null || request.ListingId == Guid.Empty || request.Quantity <= 0)
                return BadRequest("Invalid cart item request.");

            if (!TryGetUserId(out var userId))
                return Unauthorized();

            var item = await cartRepository.AddItemAsync(userId, request.ListingId, request.Quantity);
            if (item == null)
                return NotFound("Listing not found.");

            return Ok(mapper.Map<CartItemDto>(item));
        }

        [HttpPut("items/{listingId:Guid}")]
        public async Task<IActionResult> UpdateQuantity(Guid listingId, [FromBody] UpdateCartItemRequest request)
        {
            if (listingId == Guid.Empty || request == null || request.Quantity <= 0)
                return BadRequest("Quantity must be greater than zero.");

            if (!TryGetUserId(out var userId))
                return Unauthorized();

            var item = await cartRepository.UpdateQuantityAsync(userId, listingId, request.Quantity);
            if (item == null)
                return NotFound();

            return Ok(mapper.Map<CartItemDto>(item));
        }

        [HttpDelete("items/{listingId:Guid}")]
        public async Task<IActionResult> RemoveItem(Guid listingId)
        {
            if (listingId == Guid.Empty)
                return BadRequest("Invalid listing id.");

            if (!TryGetUserId(out var userId))
                return Unauthorized();

            var removed = await cartRepository.RemoveItemAsync(userId, listingId);
            if (!removed)
                return NotFound();

            return NoContent();
        }

        [HttpDelete]
        public async Task<IActionResult> Clear()
        {
            if (!TryGetUserId(out var userId))
                return Unauthorized();

            await cartRepository.ClearAsync(userId);
            return NoContent();
        }

        private bool TryGetUserId(out Guid userId)
        {
            userId = Guid.Empty;
            var userIdString = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return !string.IsNullOrEmpty(userIdString) && Guid.TryParse(userIdString, out userId);
        }
    }
}
