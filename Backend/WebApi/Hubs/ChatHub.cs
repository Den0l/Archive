using Application.Interfaces.Repositories;
using AutoMapper;
using Domain.Entities;
using Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using WebApi.ApiDtos.Messages;
using WebApi.Services;

namespace WebApi.Hubs
{
    public class ChatHub : Hub
    {
        private const int MessageMaxLength = 1000;
        private const string UserGroupPrefix = "user:";

        private readonly IMessageRepository messageRepository;
        private readonly IConversationRepository conversationRepository;
        private readonly IMapper mapper;
        private readonly UserManager<ApplicationUser> userManager;
        private readonly IBackgroundNotificationQueue backgroundNotificationQueue;
        private readonly ILogger<ChatHub> logger;

        /// <summary>
        /// Constructor for ChatHub.
        /// </summary>
        /// <param name="messageRepository">Repository for interacting with messages.</param>
        /// <param name="conversationRepository">Repository for interacting with conversations in database.</param>
        /// <param name="mapper">AutoMapper for mapping between domain models and DTOs.</param>
        public ChatHub(
            IMessageRepository messageRepository,
            IConversationRepository conversationRepository,
            IMapper mapper,
            UserManager<ApplicationUser> userManager,
            IBackgroundNotificationQueue backgroundNotificationQueue,
            ILogger<ChatHub> logger)
        {
            this.messageRepository = messageRepository;
            this.conversationRepository = conversationRepository;
            this.mapper = mapper;
            this.userManager = userManager;
            this.backgroundNotificationQueue = backgroundNotificationQueue;
            this.logger = logger;
        }

        public override async Task OnConnectedAsync()
        {
            var userIdString = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!string.IsNullOrWhiteSpace(userIdString))
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, GetUserGroup(userIdString));
            }

            await base.OnConnectedAsync();
        }

        public async Task SendMessage(Guid conversationId, string message)
        {
            string senderIdString = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(senderIdString))
            {
                throw new HubException("User is not authenticated.");
            }

            var normalizedMessage = NormalizeMultiline(message);
            if (string.IsNullOrWhiteSpace(normalizedMessage))
            {
                throw new HubException("Message cannot be empty.");
            }
            if (normalizedMessage.Length > MessageMaxLength)
            {
                throw new HubException($"Message cannot be longer than {MessageMaxLength} characters.");
            }

            Guid senderId = Guid.Parse(senderIdString);
            bool isParticipant = await conversationRepository.IsUserInConversationAsync(senderId, conversationId);
            if (!isParticipant)
            {
                throw new HubException("User is not a member of this conversation.");
            }

            var domain = new Message
            {
                Id = Guid.NewGuid(),
                ConversationId = conversationId,
                Content = normalizedMessage,
                SenderId = senderId,
                CreatedAt = DateTime.Now
            };
            domain = await messageRepository.CreateAsync(domain);
            var mappedMessage = mapper.Map<MessageDto>(domain);
            await Clients.Group(conversationId.ToString()).SendAsync(
                "ReceiveMessage",
                senderId,
                mappedMessage);

            var conversation = await conversationRepository.GetByIdAsync(conversationId);
            var recipientIds = conversation.ConversationParticipants
                .Select(participant => participant.UserId)
                .Where(userId => userId != senderId)
                .Distinct()
                .ToList();
            var recipientGroups = recipientIds
                .Select(userId => GetUserGroup(userId.ToString()));

            await Clients.Groups(recipientGroups).SendAsync(
                "ReceiveMessageNotification",
                senderId,
                mappedMessage);

            if (recipientIds.Count == 0)
            {
                return;
            }

            var sender = await userManager.FindByIdAsync(senderId.ToString());
            var recipientsToNotify = await userManager.Users
                .Where(user =>
                    recipientIds.Contains(user.Id) &&
                    user.NotifyEmailOnNewMessage &&
                    user.Email != null)
                .ToListAsync();

            foreach (var recipient in recipientsToNotify)
            {
                var recipientEmail = recipient.Email!;
                var recipientNickname = recipient.Nickname;
                var senderName = sender?.Nickname ?? "Пользователь";
                var messagePreview = normalizedMessage;
                var targetConversationId = conversationId;

                await backgroundNotificationQueue.QueueAsync(
                    (notificationEmailService, cancellationToken) =>
                        notificationEmailService.SendNewMessageNotificationAsync(
                            recipientEmail,
                            recipientNickname,
                            senderName,
                            messagePreview,
                            targetConversationId));
            }
        }

        public async Task JoinConversation(Guid conversationId)
        {
            string userIdString = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdString))
            {
                throw new HubException("User is not authenticated.");
            }

            Guid userId = Guid.Parse(userIdString);
            bool isParticipant = await conversationRepository.IsUserInConversationAsync(userId, conversationId);
            if (!isParticipant)
            {
                throw new HubException("User is not a member of this conversation.");
            }

            await Groups.AddToGroupAsync(Context.ConnectionId, conversationId.ToString());
        }

        private static string NormalizeMultiline(string value)
        {
            return string.Join(
                "\n",
                value
                    .Replace("\r\n", "\n")
                    .Split('\n')
                    .Select(line => line.Trim()))
                .Trim();
        }

        private static string GetUserGroup(string userId) => $"{UserGroupPrefix}{userId}";
    }
}
