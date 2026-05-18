using Application.Interfaces.Repositories;
using AutoMapper;
using Domain.Entities;
using Infrastructure.Identity;
using Infrastructure.Persistence.Contexts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using WebApi.ApiDtos.Checkout;
using WebApi.ApiDtos.Messages;
using WebApi.Hubs;
using WebApi.Services;

namespace WebApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class CheckoutController : AuthorizedControllerBase
    {
        private const string EmailConfirmationRequiredError =
            "EMAIL_CONFIRMATION_REQUIRED";
        private readonly IReceiptEmailService receiptEmailService;
        private readonly IListingRepository listingRepository;
        private readonly IConversationRepository conversationRepository;
        private readonly IMessageRepository messageRepository;
        private readonly IOrderRepository orderRepository;
        private readonly ICartRepository cartRepository;
        private readonly ISystemUserProvider systemUserProvider;
        private readonly MarketplaceDbContext dbContext;
        private readonly UserManager<ApplicationUser> userManager;
        private readonly IBackgroundNotificationQueue backgroundNotificationQueue;
        private readonly IHubContext<ChatHub> chatHubContext;
        private readonly IMapper mapper;
        private readonly ILogger<CheckoutController> logger;

        public CheckoutController(
            IReceiptEmailService receiptEmailService,
            IListingRepository listingRepository,
            IConversationRepository conversationRepository,
            IMessageRepository messageRepository,
            IOrderRepository orderRepository,
            ICartRepository cartRepository,
            ISystemUserProvider systemUserProvider,
            MarketplaceDbContext dbContext,
            UserManager<ApplicationUser> userManager,
            IBackgroundNotificationQueue backgroundNotificationQueue,
            IHubContext<ChatHub> chatHubContext,
            IMapper mapper,
            ILogger<CheckoutController> logger)
        {
            this.receiptEmailService = receiptEmailService;
            this.listingRepository = listingRepository;
            this.conversationRepository = conversationRepository;
            this.messageRepository = messageRepository;
            this.orderRepository = orderRepository;
            this.cartRepository = cartRepository;
            this.systemUserProvider = systemUserProvider;
            this.dbContext = dbContext;
            this.userManager = userManager;
            this.backgroundNotificationQueue = backgroundNotificationQueue;
            this.chatHubContext = chatHubContext;
            this.mapper = mapper;
            this.logger = logger;
        }

        [HttpPost("confirm")]
        public async Task<IActionResult> Confirm([FromBody] CheckoutRequest request)
        {
            if (request == null || request.Items == null || request.Items.Count == 0)
                return BadRequest("Cart is empty.");

            if (request.Items.Any(item =>
                item.Quantity <= 0 ||
                item.ListingId == Guid.Empty))
            {
                return BadRequest("Invalid cart item data.");
            }

            var unauthorizedResult = UnauthorizedIfNoAuthenticatedUserId(
                out var buyerId
            );
            if (unauthorizedResult != null)
            {
                return unauthorizedResult;
            }

            var buyer = await userManager.FindByIdAsync(buyerId.ToString());
            if (buyer == null)
                return BadRequest("User not found.");
            if (!buyer.EmailConfirmed)
                return BadRequest(EmailConfirmationRequiredError);
            if (string.IsNullOrWhiteSpace(buyer.Email))
                return BadRequest("User email not found.");

            foreach (var item in request.Items)
            {
                var listing = await listingRepository.GetByIdAsync(item.ListingId);
                var notFoundResult = NotFoundIfNull(
                    listing,
                    $"Listing {item.ListingId} not found."
                );
                if (notFoundResult != null)
                {
                    return notFoundResult;
                }

                if (listing.SellerId == buyerId)
                {
                    return BadRequest($"Нельзя купить собственное объявление: {listing.Title}.");
                }

                if (listing.IsSold || listing.IsArchived)
                {
                    return BadRequest($"Listing {listing.Title} is not available.");
                }
            }

            var systemUser = await systemUserProvider.GetSystemUserAsync();
            var now = DateTime.Now;
            var sellerOrderNotifications =
                new List<(string Email, string Nickname, string BuyerName, string ListingTitle)>();
            var hubNotifications = new List<(Guid RecipientId, Guid SenderId, Message Message)>();
            var verifiedItems = new List<CheckoutItemDto>(request.Items.Count);
            IActionResult? transactionFailureResult = null;
            var executionStrategy = dbContext.Database.CreateExecutionStrategy();

            await executionStrategy.ExecuteAsync(async () =>
            {
                transactionFailureResult = null;
                sellerOrderNotifications.Clear();
                hubNotifications.Clear();
                verifiedItems.Clear();
                dbContext.ChangeTracker.Clear();

                await using var transaction = await dbContext.Database.BeginTransactionAsync();
                foreach (var item in request.Items)
                {
                    var listing = await listingRepository.GetByIdAsync(item.ListingId);
                    var notFoundResult = NotFoundIfNull(
                        listing,
                        $"Listing {item.ListingId} not found."
                    );
                    if (notFoundResult != null)
                    {
                        transactionFailureResult = notFoundResult;
                        return;
                    }

                    if (listing.SellerId == buyerId)
                    {
                        transactionFailureResult =
                            BadRequest($"Нельзя купить собственное объявление: {listing.Title}.");
                        return;
                    }

                    var claimedRows = await dbContext.Listings
                        .Where(candidate =>
                            candidate.Id == listing.Id &&
                            !candidate.IsSold &&
                            !candidate.IsArchived)
                        .ExecuteUpdateAsync(setters => setters
                            .SetProperty(candidate => candidate.IsSold, true)
                            .SetProperty(candidate => candidate.IsArchived, false));

                    if (claimedRows == 0)
                    {
                        transactionFailureResult =
                            BadRequest($"Listing {listing.Title} is not available.");
                        return;
                    }

                    var seller = await userManager.FindByIdAsync(listing.SellerId.ToString());
                    var sellerNickname = string.IsNullOrWhiteSpace(seller?.Nickname)
                        ? "продавец"
                        : seller.Nickname;
                    var buyerLink = $"[{buyer.Nickname}](/user/{buyerId})";
                    var sellerLink = $"[{sellerNickname}](/user/{listing.SellerId})";

                    verifiedItems.Add(new CheckoutItemDto
                    {
                        ListingId = listing.Id,
                        Title = listing.Title,
                        Price = listing.Price,
                        Quantity = item.Quantity,
                    });

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
                            new ConversationParticipant
                            {
                                ConversationId = conversationId,
                                UserId = systemUser.Id
                            },
                            new ConversationParticipant
                            {
                                ConversationId = conversationId,
                                UserId = listing.SellerId
                            }
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
                        $"Новый [заказ](/user/orders?tab=seller): покупатель {buyerLink} оформил(а) покупку по объявлению {listing.Title} у продавца {sellerLink}.";
                    var message = new Message
                    {
                        Id = Guid.NewGuid(),
                        ConversationId = sellerConversation.Id,
                        SenderId = systemUser.Id,
                        Content = messageText,
                        CreatedAt = now
                    };
                    await messageRepository.CreateAsync(message);
                    hubNotifications.Add((listing.SellerId, systemUser.Id, message));

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
                            new ConversationParticipant
                            {
                                ConversationId = buyerConversationId,
                                UserId = systemUser.Id
                            },
                            new ConversationParticipant
                            {
                                ConversationId = buyerConversationId,
                                UserId = buyerId
                            }
                        }
                        };
                        await conversationRepository.CreateAsync(buyerConversation);
                    }

                    var buyerMessage = new Message
                    {
                        Id = Guid.NewGuid(),
                        ConversationId = buyerConversation.Id,
                        SenderId = systemUser.Id,
                        Content = $"Ваш [заказ](/user/orders) оформлен по объявлению {listing.Title}. Покупатель: {buyerLink}. Продавец: {sellerLink}.",
                        CreatedAt = now
                    };
                    await messageRepository.CreateAsync(buyerMessage);
                    hubNotifications.Add((buyerId, systemUser.Id, buyerMessage));

                    if (seller != null &&
                        seller.NotifyEmailOnSellerOrder &&
                        !string.IsNullOrWhiteSpace(seller.Email))
                    {
                        sellerOrderNotifications.Add((
                            seller.Email,
                            seller.Nickname,
                            buyer.Nickname,
                            listing.Title));
                    }
                }

                await dbContext.SaveChangesAsync();
                await cartRepository.ClearAsync(buyerId);
                await transaction.CommitAsync();
            });

            if (transactionFailureResult != null)
            {
                return transactionFailureResult;
            }

            var verifiedReceipt = new CheckoutRequest
            {
                Items = verifiedItems,
                TotalItems = verifiedItems.Sum(item => item.Quantity),
                TotalPrice = verifiedItems.Sum(item => item.Price * item.Quantity),
            };

            var receiptEmailSent = true;
            try
            {
                await receiptEmailService.SendReceiptAsync(
                    buyer.Email!,
                    buyer.Nickname,
                    verifiedReceipt);
            }
            catch (Exception exception)
            {
                receiptEmailSent = false;
                logger.LogWarning(
                    exception,
                    "Failed to send receipt email to {Email} after checkout commit.",
                    buyer.Email);
            }

            foreach (var (recipientId, senderId, msg) in hubNotifications)
            {
                var dto = mapper.Map<MessageDto>(msg);
                await chatHubContext.Clients
                    .Group($"user:{recipientId}")
                    .SendAsync("ReceiveMessageNotification", senderId, dto);
            }

            foreach (var notification in sellerOrderNotifications)
            {
                await backgroundNotificationQueue.QueueAsync(
                    (notificationEmailService, cancellationToken) =>
                        notificationEmailService.SendSellerOrderNotificationAsync(
                            notification.Email,
                            notification.Nickname,
                            notification.BuyerName,
                            notification.ListingTitle));
            }

            return Ok(new
            {
                message = "Order confirmed.",
                receiptEmailSent
            });
        }
    }
}
