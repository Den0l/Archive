using Application.Interfaces.Repositories;
using AutoMapper;
using Domain.Entities;
using Infrastructure.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using WebApi.ApiDtos.Conversations;
using WebApi.ApiDtos.Messages;
using WebApi.Services;

namespace WebApi.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ConversationsController : AuthorizedControllerBase
    {
        private readonly IConversationRepository conversationRepository;
        private readonly IMessageRepository messageRepository;
        private readonly ISystemUserProvider systemUserProvider;
        private readonly UserManager<ApplicationUser> userManager;
        private readonly IMapper mapper;

        public ConversationsController(
            IConversationRepository conversationRepository,
            IMessageRepository messageRepository,
            ISystemUserProvider systemUserProvider,
            UserManager<ApplicationUser> userManager,
            IMapper mapper
        )
        {
            this.conversationRepository = conversationRepository;
            this.messageRepository = messageRepository;
            this.systemUserProvider = systemUserProvider;
            this.userManager = userManager;
            this.mapper = mapper;
        }

        /// <summary>
        /// Creates a new conversation, or returns an existing one if it already exists.
        /// </summary>
        [HttpPost]
        [Authorize]
        public async Task<IActionResult> Post(CreateConversationRequest request)
        {
            var unauthorizedResult = UnauthorizedIfNoAuthenticatedUserId(
                out var senderId
            );
            if (unauthorizedResult != null)
            {
                return unauthorizedResult;
            }

            if (request.RecipientId == Guid.Empty)
            {
                return BadRequest("Некорректный получатель.");
            }

            if (request.RecipientId == senderId)
            {
                return BadRequest("Нельзя начать беседу с самим собой.");
            }

            var recipient = await userManager.FindByIdAsync(request.RecipientId.ToString());
            if (recipient == null)
            {
                return NotFound("Получатель не найден.");
            }

            var existingConversation = await conversationRepository
                .ConversationExists(senderId, request.RecipientId);
            if (existingConversation != null)
            {
                return this.OkMapped<ConversationDto>(mapper, existingConversation);
            }

            var conversationId = Guid.NewGuid();
            var participant1 = new ConversationParticipant
            {
                ConversationId = conversationId,
                UserId = senderId,
            };
            var participant2 = new ConversationParticipant
            {
                ConversationId = conversationId,
                UserId = request.RecipientId,
            };
            var conversation = new Conversation
            {
                Id = conversationId,
                ConversationParticipants = new() { participant1, participant2 },
                CreatedAt = DateTime.Now,
            };

            var domain = await conversationRepository.CreateAsync(conversation);
            return this.OkMapped<ConversationDto>(mapper, domain);
        }

        /// <summary>
        /// Retrieves messages of conversation by its ID.
        /// </summary>
        [HttpGet]
        [Route("{conversationId:Guid}/messages")]
        [Authorize]
        public async Task<IActionResult> GetMessagesById(Guid conversationId)
        {
            var unauthorizedResult = UnauthorizedIfNoAuthenticatedUserId(
                out var userId
            );
            if (unauthorizedResult != null)
            {
                return unauthorizedResult;
            }

            var isParticipant = await conversationRepository
                .IsUserInConversationAsync(userId, conversationId);
            var forbidResult = ForbidIf(!isParticipant);
            if (forbidResult != null)
            {
                return forbidResult;
            }

            var domain = await messageRepository.GetByConversationIdAsync(
                conversationId
            );
            return this.OkMapped<List<MessageDto>>(mapper, domain);
        }

        /// <summary>
        /// Retrieves conversation info by its ID.
        /// </summary>
        [HttpGet]
        [Route("{conversationId:Guid}")]
        [Authorize]
        public async Task<IActionResult> GetById(Guid conversationId)
        {
            var unauthorizedResult = UnauthorizedIfNoAuthenticatedUserId(
                out var userId
            );
            if (unauthorizedResult != null)
            {
                return unauthorizedResult;
            }

            var isParticipant = await conversationRepository
                .IsUserInConversationAsync(userId, conversationId);
            var forbidResult = ForbidIf(!isParticipant);
            if (forbidResult != null)
            {
                return forbidResult;
            }

            var domain = await conversationRepository.GetByIdAsync(conversationId);
            var notFoundResult = NotFoundIfNull(domain);
            if (notFoundResult != null)
            {
                return notFoundResult;
            }

            return this.OkMapped<ConversationDto>(mapper, domain);
        }

        /// <summary>
        /// Gets all conversations for currently authorized user.
        /// </summary>
        [HttpGet]
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

            var domain = await conversationRepository.GetByUserIdAsync(userId);
            return this.OkMapped<List<ConversationDto>>(mapper, domain);
        }

        /// <summary>
        /// Ensures a conversation between the current user and the system user exists.
        /// Creates one if it doesn't exist. Returns the conversation.
        /// </summary>
        [HttpPost("ensure-system")]
        [Authorize]
        public async Task<IActionResult> EnsureSystemConversation()
        {
            var unauthorizedResult = UnauthorizedIfNoAuthenticatedUserId(
                out var userId
            );
            if (unauthorizedResult != null)
            {
                return unauthorizedResult;
            }

            var systemUser = await systemUserProvider.GetSystemUserAsync();

            if (systemUser.Id == userId)
            {
                return Ok(
                    new { conversationId = (Guid?)null, systemUserId = systemUser.Id }
                );
            }

            var existing = await conversationRepository.ConversationExists(
                systemUser.Id,
                userId
            );
            if (existing != null)
            {
                return Ok(
                    new
                    {
                        conversationId = existing.Id,
                        systemUserId = systemUser.Id,
                    }
                );
            }

            var conversationId = Guid.NewGuid();
            var now = DateTime.Now;
            var conversation = new Conversation
            {
                Id = conversationId,
                CreatedAt = now,
                LastUpdatedAt = now,
                ConversationParticipants = new()
                {
                    new ConversationParticipant
                    {
                        ConversationId = conversationId,
                        UserId = systemUser.Id,
                    },
                    new ConversationParticipant
                    {
                        ConversationId = conversationId,
                        UserId = userId,
                    },
                },
            };
            await conversationRepository.CreateAsync(conversation);

            return Ok(
                new
                {
                    conversationId = conversation.Id,
                    systemUserId = systemUser.Id,
                }
            );
        }

        /// <summary>
        /// Returns the system user's ID.
        /// </summary>
        [HttpGet("system-user-id")]
        [AllowAnonymous]
        public async Task<IActionResult> GetSystemUserId()
        {
            var systemUser = await systemUserProvider.GetSystemUserAsync();
            return Ok(new { systemUserId = systemUser.Id });
        }
    }
}
