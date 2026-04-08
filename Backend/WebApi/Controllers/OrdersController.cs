using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading.Tasks;
using Application.Interfaces.Repositories;
using Domain.Entities;
using Infrastructure.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using WebApi.ApiDtos.Orders;
using WebApi.Services;

namespace WebApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class OrdersController : ControllerBase
    {
        private readonly IOrderRepository orderRepository;
        private readonly IListingRepository listingRepository;
        private readonly IConversationRepository conversationRepository;
        private readonly IMessageRepository messageRepository;
        private readonly ISystemUserProvider systemUserProvider;
        private readonly UserManager<ApplicationUser> userManager;

        public OrdersController(
            IOrderRepository orderRepository,
            IListingRepository listingRepository,
            IConversationRepository conversationRepository,
            IMessageRepository messageRepository,
            ISystemUserProvider systemUserProvider,
            UserManager<ApplicationUser> userManager)
        {
            this.orderRepository = orderRepository;
            this.listingRepository = listingRepository;
            this.conversationRepository = conversationRepository;
            this.messageRepository = messageRepository;
            this.systemUserProvider = systemUserProvider;
            this.userManager = userManager;
        }

        [HttpGet("by-conversation/{conversationId:Guid}")]
        public async Task<IActionResult> GetByConversation(Guid conversationId)
        {
            var order = await orderRepository.GetByConversationIdAsync(conversationId);
            if (order == null)
                return NotFound();

            if (!TryGetUserId(out var userId))
                return Unauthorized();

            if (order.SellerId != userId && order.BuyerId != userId)
                return Forbid();

            var dto = await MapToDtoAsync(order);
            return Ok(dto);
        }

        [HttpGet("by-conversation/{conversationId:Guid}/all")]
        public async Task<IActionResult> GetAllByConversation(Guid conversationId)
        {
            if (!TryGetUserId(out var userId))
                return Unauthorized();

            var isParticipant = await conversationRepository.IsUserInConversationAsync(
                userId,
                conversationId
            );
            if (!isParticipant)
                return Forbid();

            var orders = await orderRepository.GetAllByConversationIdAsync(conversationId);
            var dtos = new List<OrderDto>(orders.Count);

            foreach (var order in orders)
            {
                dtos.Add(await MapToDtoAsync(order));
            }

            return Ok(dtos);
        }

        [HttpGet("by-listing/{listingId:Guid}/pending")]
        public async Task<IActionResult> GetLatestPendingByListing(Guid listingId)
        {
            if (!TryGetUserId(out var userId))
                return Unauthorized();

            var order = await orderRepository.GetLatestPendingByListingIdAsync(listingId);
            if (order == null)
                return NotFound();

            if (order.SellerId != userId && order.BuyerId != userId)
                return Forbid();

            var dto = await MapToDtoAsync(order);
            return Ok(dto);
        }

        [HttpPost("{orderId:Guid}/cancel")]
        public async Task<IActionResult> Cancel(Guid orderId)
        {
            if (!TryGetUserId(out var userId))
                return Unauthorized();

            var order = await orderRepository.GetByIdAsync(orderId);
            if (order == null)
                return NotFound();

            if (order.SellerId != userId)
                return Forbid();

            if (order.Status != OrderStatus.Pending)
                return BadRequest("Order cannot be cancelled.");

            order.Status = OrderStatus.Cancelled;
            order.CancelledAt = DateTime.Now;

            var listing = await listingRepository.GetByIdAsync(order.ListingId);
            if (listing != null)
            {
                listing.IsSold = false;
                listing.IsArchived = false;
                await listingRepository.UpdateAsync(listing.Id, listing);
            }

            await orderRepository.UpdateAsync(order);

            var systemUser = await systemUserProvider.GetSystemUserAsync();
            var now = DateTime.Now;
            var title = listing?.Title ?? "объявление";

            var sellerMessage = new Message
            {
                Id = Guid.NewGuid(),
                ConversationId = order.ConversationId,
                SenderId = systemUser.Id,
                Content = $"Заказ по объявлению \"{title}\" отменён продавцом.",
                CreatedAt = now
            };
            await messageRepository.CreateAsync(sellerMessage);

            var buyerConversation = await conversationRepository
                .ConversationExists(systemUser.Id, order.BuyerId);
            if (buyerConversation == null)
            {
                var buyerConversationId = Guid.NewGuid();
                buyerConversation = new Conversation
                {
                    Id = buyerConversationId,
                    CreatedAt = now,
                    LastUpdatedAt = now,
                    ConversationParticipants = new()
                    {
                        new ConversationParticipant { ConversationId = buyerConversationId, UserId = systemUser.Id },
                        new ConversationParticipant { ConversationId = buyerConversationId, UserId = order.BuyerId }
                    }
                };
                await conversationRepository.CreateAsync(buyerConversation);
            }

            var buyerMessage = new Message
            {
                Id = Guid.NewGuid(),
                ConversationId = buyerConversation.Id,
                SenderId = systemUser.Id,
                Content = $"Ваш заказ по объявлению \"{title}\" отменён продавцом.",
                CreatedAt = now
            };
            await messageRepository.CreateAsync(buyerMessage);
            return Ok();
        }

        [HttpPost("{orderId:Guid}/archive")]
        public async Task<IActionResult> ArchiveListing(Guid orderId)
        {
            if (!TryGetUserId(out var userId))
                return Unauthorized();

            var order = await orderRepository.GetByIdAsync(orderId);
            if (order == null)
                return NotFound();

            if (order.SellerId != userId)
                return Forbid();

            var listing = await listingRepository.GetByIdAsync(order.ListingId);
            if (listing == null)
                return NotFound();

            listing.IsArchived = true;
            await listingRepository.UpdateAsync(listing.Id, listing);
            return Ok();
        }

        [HttpPost("{orderId:Guid}/unarchive")]
        public async Task<IActionResult> UnarchiveListing(Guid orderId)
        {
            if (!TryGetUserId(out var userId))
                return Unauthorized();

            var order = await orderRepository.GetByIdAsync(orderId);
            if (order == null)
                return NotFound();

            if (order.SellerId != userId)
                return Forbid();

            var listing = await listingRepository.GetByIdAsync(order.ListingId);
            if (listing == null)
                return NotFound();

            listing.IsArchived = false;
            await listingRepository.UpdateAsync(listing.Id, listing);
            return Ok();
        }

        private bool TryGetUserId(out Guid userId)
        {
            userId = Guid.Empty;
            var userIdString = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return !string.IsNullOrEmpty(userIdString) && Guid.TryParse(userIdString, out userId);
        }

        private async Task<OrderDto> MapToDtoAsync(Order order)
        {
            var buyer = await userManager.FindByIdAsync(order.BuyerId.ToString());
            return new OrderDto
            {
                Id = order.Id,
                ListingId = order.ListingId,
                ListingTitle = order.Listing?.Title ?? string.Empty,
                BuyerId = order.BuyerId,
                BuyerNickname = buyer?.Nickname ?? string.Empty,
                SellerId = order.SellerId,
                ConversationId = order.ConversationId,
                Status = order.Status,
                CreatedAt = order.CreatedAt,
                IsListingSold = order.Listing?.IsSold ?? false,
                IsListingArchived = order.Listing?.IsArchived ?? false
            };
        }
    }
}
