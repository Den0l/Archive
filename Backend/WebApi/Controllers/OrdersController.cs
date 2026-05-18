using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Application.Interfaces.Repositories;
using AutoMapper;
using Domain.Entities;
using Infrastructure.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using WebApi.ApiDtos.Messages;
using WebApi.ApiDtos.Orders;
using WebApi.Hubs;
using WebApi.Services;

namespace WebApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class OrdersController : AuthorizedControllerBase
    {
        private readonly IOrderRepository orderRepository;
        private readonly IListingRepository listingRepository;
        private readonly IConversationRepository conversationRepository;
        private readonly IMessageRepository messageRepository;
        private readonly ISystemUserProvider systemUserProvider;
        private readonly UserManager<ApplicationUser> userManager;
        private readonly IHubContext<ChatHub> chatHubContext;
        private readonly IMapper mapper;

        public OrdersController(
            IOrderRepository orderRepository,
            IListingRepository listingRepository,
            IConversationRepository conversationRepository,
            IMessageRepository messageRepository,
            ISystemUserProvider systemUserProvider,
            UserManager<ApplicationUser> userManager,
            IHubContext<ChatHub> chatHubContext,
            IMapper mapper)
        {
            this.orderRepository = orderRepository;
            this.listingRepository = listingRepository;
            this.conversationRepository = conversationRepository;
            this.messageRepository = messageRepository;
            this.systemUserProvider = systemUserProvider;
            this.userManager = userManager;
            this.chatHubContext = chatHubContext;
            this.mapper = mapper;
        }

        [HttpGet("by-conversation/{conversationId:Guid}")]
        public async Task<IActionResult> GetByConversation(Guid conversationId)
        {
            var order = await orderRepository.GetByConversationIdAsync(conversationId);
            if (order == null)
                return NotFound();

            if (!TryGetAuthenticatedUserId(out var userId))
                return Unauthorized();

            if (order.SellerId != userId && order.BuyerId != userId)
                return Forbid();

            var dto = await MapToDtoAsync(order);
            return Ok(dto);
        }

        [HttpGet("by-conversation/{conversationId:Guid}/all")]
        public async Task<IActionResult> GetAllByConversation(Guid conversationId)
        {
            if (!TryGetAuthenticatedUserId(out var userId))
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
            if (!TryGetAuthenticatedUserId(out var userId))
                return Unauthorized();

            var order = await orderRepository.GetLatestPendingByListingIdAsync(listingId);
            if (order == null)
                return NotFound();

            if (order.SellerId != userId && order.BuyerId != userId)
                return Forbid();

            var dto = await MapToDtoAsync(order);
            return Ok(dto);
        }

        [HttpGet("my/as-buyer")]
        public async Task<IActionResult> GetMyOrdersAsBuyer()
        {
            if (!TryGetAuthenticatedUserId(out var userId))
                return Unauthorized();

            var orders = await orderRepository.GetByBuyerIdAsync(userId);
            var dtos = new List<OrderDto>(orders.Count);
            foreach (var order in orders)
            {
                dtos.Add(await MapToDtoAsync(order));
            }
            return Ok(dtos);
        }

        [HttpGet("my/as-seller")]
        public async Task<IActionResult> GetMyOrdersAsSeller()
        {
            if (!TryGetAuthenticatedUserId(out var userId))
                return Unauthorized();

            var orders = await orderRepository.GetBySellerIdAsync(userId);
            var dtos = new List<OrderDto>(orders.Count);
            foreach (var order in orders)
            {
                dtos.Add(await MapToDtoAsync(order));
            }
            return Ok(dtos);
        }

                [HttpPost("{orderId:Guid}/complete")]
        public async Task<IActionResult> Complete(Guid orderId)
        {
            if (!TryGetAuthenticatedUserId(out var userId))
                return Unauthorized();

            var order = await orderRepository.GetByIdAsync(orderId);
            if (order == null)
                return NotFound();

            if (order.SellerId != userId && !await IsAdminAsync(userId))
                return Forbid();

            if (order.Status != OrderStatus.Pending)
                return BadRequest("Order cannot be completed.");

            order.Status = OrderStatus.Completed;
            await orderRepository.UpdateAsync(order);

            var systemUser = await systemUserProvider.GetSystemUserAsync();
            var now = DateTime.Now;
            var listingTitle = order.Listing?.Title ?? "объявлению";
            var listingLink = $"[{listingTitle}](/listing/{order.ListingId})";
            var buyer = await userManager.FindByIdAsync(order.BuyerId.ToString());
            var seller = await userManager.FindByIdAsync(order.SellerId.ToString());
            var buyerNickname = string.IsNullOrWhiteSpace(buyer?.Nickname)
                ? "покупатель"
                : buyer.Nickname;
            var sellerNickname = string.IsNullOrWhiteSpace(seller?.Nickname)
                ? "продавец"
                : seller.Nickname;
            var buyerLink = $"[{buyerNickname}](/user/{order.BuyerId})";
            var sellerLink = $"[{sellerNickname}](/user/{order.SellerId})";

            var sellerMessage = new Message
            {
                Id = Guid.NewGuid(),
                ConversationId = order.ConversationId,
                SenderId = systemUser.Id,
                Content = $"Заказ по объявлению {listingLink} подтверждён. Покупатель: {buyerLink}. Продавец: {sellerLink}.",
                CreatedAt = now
            };
            await messageRepository.CreateAsync(sellerMessage);
            await chatHubContext.Clients
                .Group($"user:{order.SellerId}")
                .SendAsync("ReceiveMessageNotification", systemUser.Id, mapper.Map<MessageDto>(sellerMessage));

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
                Content = $"Ваш заказ по объявлению {listingLink} подтверждён продавцом {sellerLink}. Покупатель: {buyerLink}.",
                CreatedAt = now
            };
            await messageRepository.CreateAsync(buyerMessage);
            await chatHubContext.Clients
                .Group($"user:{order.BuyerId}")
                .SendAsync("ReceiveMessageNotification", systemUser.Id, mapper.Map<MessageDto>(buyerMessage));

            return Ok();
        }

                [HttpPost("{orderId:Guid}/cancel")]
        public async Task<IActionResult> Cancel(Guid orderId)
        {
            if (!TryGetAuthenticatedUserId(out var userId))
                return Unauthorized();

            var order = await orderRepository.GetByIdAsync(orderId);
            if (order == null)
                return NotFound();

            if (order.SellerId != userId && !await IsAdminAsync(userId))
                return Forbid();

            if (order.Status != OrderStatus.Pending)
                return BadRequest("Order cannot be cancelled.");

            order.Status = OrderStatus.Cancelled;
            order.CancelledAt = DateTime.Now;

            var listing = await listingRepository.GetByIdAsync(order.ListingId);
            if (listing != null && listing.IsSold)
            {
                var hasOtherActive = await orderRepository
                    .HasOtherActiveOrderAsync(listing.Id, order.Id);
                if (!hasOtherActive)
                {
                    listing.IsSold = false;
                    await listingRepository.UpdateAsync(listing.Id, listing);
                }
            }

            await orderRepository.UpdateAsync(order);

            var systemUser = await systemUserProvider.GetSystemUserAsync();
            var now = DateTime.Now;
            var listingTitle = listing?.Title ?? "объявлению";
            var listingLink = $"[{listingTitle}](/listing/{order.ListingId})";
            var buyer = await userManager.FindByIdAsync(order.BuyerId.ToString());
            var seller = await userManager.FindByIdAsync(order.SellerId.ToString());
            var buyerNickname = string.IsNullOrWhiteSpace(buyer?.Nickname)
                ? "покупатель"
                : buyer.Nickname;
            var sellerNickname = string.IsNullOrWhiteSpace(seller?.Nickname)
                ? "продавец"
                : seller.Nickname;
            var buyerLink = $"[{buyerNickname}](/user/{order.BuyerId})";
            var sellerLink = $"[{sellerNickname}](/user/{order.SellerId})";

            var sellerMessage = new Message
            {
                Id = Guid.NewGuid(),
                ConversationId = order.ConversationId,
                SenderId = systemUser.Id,
                Content = $"Заказ по объявлению {listingLink} отменён продавцом {sellerLink}. Покупатель: {buyerLink}.",
                CreatedAt = now
            };
            await messageRepository.CreateAsync(sellerMessage);
            await chatHubContext.Clients
                .Group($"user:{order.SellerId}")
                .SendAsync("ReceiveMessageNotification", systemUser.Id, mapper.Map<MessageDto>(sellerMessage));

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
                Content = $"Ваш заказ по объявлению {listingLink} отменён продавцом {sellerLink}. Покупатель: {buyerLink}.",
                CreatedAt = now
            };
            await messageRepository.CreateAsync(buyerMessage);
            await chatHubContext.Clients
                .Group($"user:{order.BuyerId}")
                .SendAsync("ReceiveMessageNotification", systemUser.Id, mapper.Map<MessageDto>(buyerMessage));

            return Ok();
        }

        [HttpPost("{orderId:Guid}/archive")]
        public async Task<IActionResult> ArchiveListing(Guid orderId)
        {
            if (!TryGetAuthenticatedUserId(out var userId))
                return Unauthorized();

            var order = await orderRepository.GetByIdAsync(orderId);
            if (order == null)
                return NotFound();

            if (order.SellerId != userId && !await IsAdminAsync(userId))
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
            if (!TryGetAuthenticatedUserId(out var userId))
                return Unauthorized();

            var order = await orderRepository.GetByIdAsync(orderId);
            if (order == null)
                return NotFound();

            if (order.SellerId != userId && !await IsAdminAsync(userId))
                return Forbid();

            var listing = await listingRepository.GetByIdAsync(order.ListingId);
            if (listing == null)
                return NotFound();

            listing.IsArchived = false;
            await listingRepository.UpdateAsync(listing.Id, listing);
            return Ok();
        }

        private async Task<bool> IsAdminAsync(Guid userId)
        {
            var user = await userManager.FindByIdAsync(userId.ToString());
            if (user == null)
            {
                return false;
            }

            return await userManager.IsInRoleAsync(user, "Admin");
        }

        private async Task<OrderDto> MapToDtoAsync(Order order)
        {
            var buyer = await userManager.FindByIdAsync(order.BuyerId.ToString());
            var seller = await userManager.FindByIdAsync(order.SellerId.ToString());
            return new OrderDto
            {
                Id = order.Id,
                ListingId = order.ListingId,
                ListingTitle = order.Listing?.Title ?? string.Empty,
                ListingPrice = order.Listing?.Price ?? 0,
                ListingImageUrl = order.Listing?.Images?.FirstOrDefault()?.ImageUrl,
                BuyerId = order.BuyerId,
                BuyerNickname = buyer?.Nickname ?? string.Empty,
                SellerId = order.SellerId,
                SellerNickname = seller?.Nickname ?? string.Empty,
                ConversationId = order.ConversationId,
                Status = order.Status,
                CreatedAt = order.CreatedAt,
                CancelledAt = order.CancelledAt,
                IsListingSold = order.Listing?.IsSold ?? false,
                IsListingArchived = order.Listing?.IsArchived ?? false
            };
        }
    }
}
