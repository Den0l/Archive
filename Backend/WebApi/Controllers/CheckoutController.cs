using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Application.Interfaces.Repositories;
using Domain.Entities;
using Infrastructure.Persistence.Contexts;
using Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using WebApi.ApiDtos.Checkout;
using WebApi.Services;
using Microsoft.Extensions.Logging;

namespace WebApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class CheckoutController : ControllerBase
    {
        private readonly IReceiptEmailService receiptEmailService;
        private readonly IListingRepository listingRepository;
        private readonly IConversationRepository conversationRepository;
        private readonly IMessageRepository messageRepository;
        private readonly IOrderRepository orderRepository;
        private readonly ISystemUserProvider systemUserProvider;
        private readonly MarketplaceDbContext dbContext;
        private readonly UserManager<ApplicationUser> userManager;
        private readonly ILogger<CheckoutController> logger;

        public CheckoutController(
            IReceiptEmailService receiptEmailService,
            IListingRepository listingRepository,
            IConversationRepository conversationRepository,
            IMessageRepository messageRepository,
            IOrderRepository orderRepository,
            ISystemUserProvider systemUserProvider,
            MarketplaceDbContext dbContext,
            UserManager<ApplicationUser> userManager,
            ILogger<CheckoutController> logger)
        {
            this.receiptEmailService = receiptEmailService;
            this.listingRepository = listingRepository;
            this.conversationRepository = conversationRepository;
            this.messageRepository = messageRepository;
            this.orderRepository = orderRepository;
            this.systemUserProvider = systemUserProvider;
            this.dbContext = dbContext;
            this.userManager = userManager;
            this.logger = logger;
        }

        [HttpPost("confirm")]
        public async Task<IActionResult> Confirm([FromBody] CheckoutRequest request)
        {
            if (request == null || request.Items == null || request.Items.Count == 0)
                return BadRequest("Cart is empty.");

            if (request.Items.Any(i => i.Quantity <= 0 || i.Price < 0 || i.ListingId == Guid.Empty))
                return BadRequest("Invalid cart item data.");

            var email = User.FindFirst(ClaimTypes.Email)?.Value;
            if (string.IsNullOrWhiteSpace(email))
                return BadRequest("User email not found.");

            var nickname = User.FindFirst("nickname")?.Value;
            var buyerIdString = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrWhiteSpace(buyerIdString) || !Guid.TryParse(buyerIdString, out var buyerId))
                return BadRequest("User id not found.");

            var buyer = await userManager.FindByIdAsync(buyerId.ToString());
            if (buyer == null)
                return BadRequest("User not found.");

            // First, ensure all listings are available before sending the receipt.
            foreach (var item in request.Items)
            {
                var listing = await listingRepository.GetByIdAsync(item.ListingId);
                if (listing == null)
                {
                    return NotFound($"Listing {item.ListingId} not found.");
                }
                if (listing.IsSold || listing.IsArchived)
                {
                    return BadRequest($"Listing {listing.Title} is not available.");
                }
            }

            var receiptEmailSent = true;
            try
            {
                await receiptEmailService.SendReceiptAsync(email, nickname, request);
            }
            catch (Exception ex)
            {
                receiptEmailSent = false;
                logger.LogWarning(
                    ex,
                    "Failed to send receipt email to {Email} during checkout confirmation.",
                    email
                );
            }

            var systemUser = await systemUserProvider.GetSystemUserAsync();
            var now = DateTime.Now;

            using var transaction = await dbContext.Database.BeginTransactionAsync();
            foreach (var item in request.Items)
            {
                var listing = await listingRepository.GetByIdAsync(item.ListingId);
                if (listing == null)
                {
                    await transaction.RollbackAsync();
                    return NotFound($"Listing {item.ListingId} not found.");
                }

                if (listing.IsSold || listing.IsArchived)
                {
                    await transaction.RollbackAsync();
                    return BadRequest($"Listing {listing.Title} is not available.");
                }

                listing.IsSold = true;
                listing.IsArchived = false;

                var sellerConversation = await conversationRepository
                    .ConversationExists(systemUser.Id, listing.SellerId);
                if (sellerConversation == null)
                {
                    var conversationId = Guid.NewGuid();
                    sellerConversation = new Conversation
                    {
                        Id = conversationId,
                        CreatedAt = now,
                        LastUpdatedAt = now,
                        ConversationParticipants = new()
                        {
                            new ConversationParticipant { ConversationId = conversationId, UserId = systemUser.Id },
                            new ConversationParticipant { ConversationId = conversationId, UserId = listing.SellerId }
                        }
                    };
                    await conversationRepository.CreateAsync(sellerConversation);
                }

                var order = new Order
                {
                    Id = Guid.NewGuid(),
                    ListingId = listing.Id,
                    BuyerId = buyerId,
                    SellerId = listing.SellerId,
                    ConversationId = sellerConversation.Id,
                    Status = OrderStatus.Pending,
                    CreatedAt = now
                };
                await orderRepository.CreateAsync(order);

                var messageText =
                    $"Новый заказ: {buyer.Nickname} оформил(а) заказ на объявление \"{listing.Title}\".";
                var message = new Message
                {
                    Id = Guid.NewGuid(),
                    ConversationId = sellerConversation.Id,
                    SenderId = systemUser.Id,
                    Content = messageText,
                    CreatedAt = now
                };
                await messageRepository.CreateAsync(message);

                var buyerConversation = await conversationRepository
                    .ConversationExists(systemUser.Id, buyerId);
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
                            new ConversationParticipant { ConversationId = buyerConversationId, UserId = buyerId }
                        }
                    };
                    await conversationRepository.CreateAsync(buyerConversation);
                }

                var buyerMessage = new Message
                {
                    Id = Guid.NewGuid(),
                    ConversationId = buyerConversation.Id,
                    SenderId = systemUser.Id,
                    Content = $"Ваш заказ оформлен: \"{listing.Title}\".",
                    CreatedAt = now
                };
                await messageRepository.CreateAsync(buyerMessage);
            }

            await dbContext.SaveChangesAsync();
            await transaction.CommitAsync();

            return Ok(new
            {
                message = "Order confirmed.",
                receiptEmailSent
            });
        }
    }
}
