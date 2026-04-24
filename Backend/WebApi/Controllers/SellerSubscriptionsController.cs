using Application.Interfaces.Repositories;
using Infrastructure.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WebApi.ApiDtos.Users;

namespace WebApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class SellerSubscriptionsController : AuthorizedControllerBase
    {
        private readonly ISellerSubscriptionRepository sellerSubscriptionRepository;
        private readonly UserManager<ApplicationUser> userManager;

        public SellerSubscriptionsController(
            ISellerSubscriptionRepository sellerSubscriptionRepository,
            UserManager<ApplicationUser> userManager)
        {
            this.sellerSubscriptionRepository = sellerSubscriptionRepository;
            this.userManager = userManager;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            if (!TryGetAuthenticatedUserId(out var userId))
                return Unauthorized();

            var subscriptions = await sellerSubscriptionRepository.GetBySubscriberIdAsync(userId);
            var sellerIds = subscriptions.Select(subscription => subscription.SellerId).Distinct().ToList();
            var sellers = await userManager.Users
                .Where(user => sellerIds.Contains(user.Id))
                .ToDictionaryAsync(user => user.Id, user => user.Nickname);

            var result = subscriptions.Select(subscription => new SellerSubscriptionDto
            {
                SellerId = subscription.SellerId,
                SellerNickname = sellers.GetValueOrDefault(subscription.SellerId, string.Empty),
                SubscribedAt = subscription.CreatedAt
            });

            return Ok(result);
        }

        [HttpGet("{sellerId:guid}/status")]
        public async Task<IActionResult> GetStatus(Guid sellerId)
        {
            if (sellerId == Guid.Empty)
                return BadRequest("Некорректный идентификатор продавца.");

            if (!TryGetAuthenticatedUserId(out var userId))
                return Unauthorized();

            var seller = await userManager.FindByIdAsync(sellerId.ToString());
            if (seller == null)
                return NotFound("Продавец не найден.");

            var isSubscribed = await sellerSubscriptionRepository.IsSubscribedAsync(userId, sellerId);
            return Ok(new SellerSubscriptionStatusDto
            {
                SellerId = sellerId,
                IsSubscribed = isSubscribed
            });
        }

        [HttpPost("{sellerId:guid}")]
        public async Task<IActionResult> Subscribe(Guid sellerId)
        {
            if (sellerId == Guid.Empty)
                return BadRequest("Некорректный идентификатор продавца.");

            if (!TryGetAuthenticatedUserId(out var userId))
                return Unauthorized();

            if (userId == sellerId)
                return BadRequest("Нельзя подписаться на самого себя.");

            var seller = await userManager.FindByIdAsync(sellerId.ToString());
            if (seller == null)
                return NotFound("Продавец не найден.");

            var subscription = await sellerSubscriptionRepository.AddAsync(userId, sellerId);
            return Ok(new SellerSubscriptionDto
            {
                SellerId = subscription.SellerId,
                SellerNickname = seller.Nickname,
                SubscribedAt = subscription.CreatedAt
            });
        }

        [HttpDelete("{sellerId:guid}")]
        public async Task<IActionResult> Unsubscribe(Guid sellerId)
        {
            if (sellerId == Guid.Empty)
                return BadRequest("Некорректный идентификатор продавца.");

            if (!TryGetAuthenticatedUserId(out var userId))
                return Unauthorized();

            if (userId == sellerId)
                return BadRequest("Нельзя отписаться от самого себя.");

            var removed = await sellerSubscriptionRepository.RemoveAsync(userId, sellerId);
            if (!removed)
                return NotFound("Подписка не найдена.");

            return NoContent();
        }

    }
}
