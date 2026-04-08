using Application.Interfaces.Repositories;
using AutoMapper;
using Domain.Entities;
using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;
using WebApi.ApiDtos.Messages;

namespace WebApi.Hubs
{
    public class ChatHub : Hub
    {
        private const int MessageMaxLength = 1000;
        private const string UserGroupPrefix = "user:";

        private readonly IMessageRepository messageRepository;
        private readonly IConversationRepository conversationRepository;
        private readonly IMapper mapper;

        /// <summary>
        /// Constructor for ChatHub.
        /// </summary>
        /// <param name="messageRepository">Repository for interacting with messages.</param>
        /// <param name="conversationRepository">Repository for interacting with conversations in database.</param>
        /// <param name="mapper">AutoMapper for mapping between domain models and DTOs.</param>
        public ChatHub(
            IMessageRepository messageRepository,
            IConversationRepository conversationRepository,
            IMapper mapper)
        {
            this.messageRepository = messageRepository;
            this.conversationRepository = conversationRepository;
            this.mapper = mapper;
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
                .Select(userId => GetUserGroup(userId.ToString()));

            await Clients.Groups(recipientIds).SendAsync(
                "ReceiveMessageNotification",
                senderId,
                mappedMessage);
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
