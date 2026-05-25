using AutoMapper;
using Infrastructure.Identity;
using Infrastructure.Identity.Interfaces;
using Infrastructure.Persistence.Contexts;
using Infrastructure.Persistence.Repositories;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using WebApi.ApiDtos.Auth;
using WebApi.ApiDtos.Users;
using WebApi.Controllers;
using WebApi.Services;
using Xunit;

namespace Test
{
    public class UserSettingsAndSubscriptionsTests
    {
        [Fact]
        public async Task RequestEmailChange_SavesPendingEmail_AndSendsConfirmation()
        {
            using var fixture = new TestFixture();
            var user = await fixture.CreateUserAsync("old@example.com", "SellerOne");
            var emailService = new FakeNotificationEmailService();
            var controller = fixture.CreateUsersController(user.Id, emailService);

            var result = await controller.RequestEmailChange(new RequestEmailChangeRequest
            {
                NewEmail = "new@example.com"
            });

            var okResult = Assert.IsType<OkObjectResult>(result);
            var settings = Assert.IsType<UserSettingsDto>(okResult.Value);
            Assert.Equal("new@example.com", settings.PendingEmail);

            var reloadedUser = await fixture.UserManager.FindByIdAsync(user.Id.ToString());
            Assert.NotNull(reloadedUser);
            Assert.Equal("new@example.com", reloadedUser!.PendingEmail);
            Assert.Equal(1, emailService.EmailChangeCodeCount);
        }

        [Fact]
        public async Task ChangePassword_UpdatesStoredPasswordHash()
        {
            using var fixture = new TestFixture();
            var user = await fixture.CreateUserAsync("old@example.com", "SellerOne");
            var controller = fixture.CreateUsersController(
                user.Id,
                new FakeNotificationEmailService());

            var result = await controller.ChangePassword(new ChangePasswordRequest
            {
                CurrentPassword = TestFixture.ValidPassword,
                NewPassword = "NewPass123!",
                ConfirmNewPassword = "NewPass123!"
            });

            Assert.IsType<OkObjectResult>(result);
            var reloadedUser = await fixture.UserManager.FindByIdAsync(user.Id.ToString());
            Assert.NotNull(reloadedUser);
            Assert.True(
                await fixture.UserManager.CheckPasswordAsync(
                    reloadedUser!,
                    "NewPass123!"));
        }

        [Fact]
        public async Task ConfirmEmailChange_UpdatesEmail_AndClearsPendingEmail()
        {
            using var fixture = new TestFixture();
            var user = await fixture.CreateUserAsync("old@example.com", "SellerOne");
            user.PendingEmail = "new@example.com";
            await fixture.UserManager.UpdateAsync(user);
            var token = await fixture.UserManager.GenerateChangeEmailTokenAsync(
                user,
                "new@example.com");

            var controller = fixture.CreateAuthController(
                new FakeBackgroundNotificationQueue());
            var result = await controller.ConfirmEmailChange(new ConfirmEmailChangeRequest
            {
                UserId = user.Id,
                NewEmail = "new@example.com",
                Token = token
            });

            Assert.IsType<OkObjectResult>(result);

            var reloadedUser = await fixture.UserManager.FindByIdAsync(user.Id.ToString());
            Assert.NotNull(reloadedUser);
            Assert.Equal("new@example.com", reloadedUser!.Email);
            Assert.Equal("new@example.com", reloadedUser.UserName);
            Assert.Null(reloadedUser.PendingEmail);
        }

        [Fact]
        public async Task Login_QueuesNotification_WithoutBlockingResponse()
        {
            using var fixture = new TestFixture();
            var user = await fixture.CreateUserAsync("old@example.com", "SellerOne");
            var backgroundQueue = new FakeBackgroundNotificationQueue();
            var controller = fixture.CreateAuthController(backgroundQueue);

            controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
            };
            controller.Request.Headers.UserAgent = "IntegrationTest";

            var result = await controller.Login(new LoginRequest
            {
                Username = "old@example.com",
                Password = TestFixture.ValidPassword
            });

            var okResult = Assert.IsType<OkObjectResult>(result);
            var response = Assert.IsType<LoginResponse>(okResult.Value);
            Assert.Equal("token", response.JwtToken);
            Assert.Equal(1, backgroundQueue.EnqueuedCount);

            var reloadedUser = await fixture.UserManager.FindByIdAsync(user.Id.ToString());
            Assert.NotNull(reloadedUser);
            Assert.True(reloadedUser!.LastLoggedIn > DateTime.MinValue);
        }

        [Fact]
        public async Task SellerSubscriptionsController_SubscribeAndUnsubscribe_Work()
        {
            using var fixture = new TestFixture();
            var subscriber = await fixture.CreateUserAsync("buyer@example.com", "Buyer");
            var seller = await fixture.CreateUserAsync("seller@example.com", "Seller");
            var controller = fixture.CreateSellerSubscriptionsController(subscriber.Id);

            var subscribeResult = await controller.Subscribe(seller.Id);
            var subscribeOk = Assert.IsType<OkObjectResult>(subscribeResult);
            var subscription = Assert.IsType<SellerSubscriptionDto>(subscribeOk.Value);
            Assert.Equal(seller.Id, subscription.SellerId);

            var statusResult = await controller.GetStatus(seller.Id);
            var statusOk = Assert.IsType<OkObjectResult>(statusResult);
            var status = Assert.IsType<SellerSubscriptionStatusDto>(statusOk.Value);
            Assert.True(status.IsSubscribed);

            var unsubscribeResult = await controller.Unsubscribe(seller.Id);
            Assert.IsType<NoContentResult>(unsubscribeResult);

            var reloadedStatusResult = await controller.GetStatus(seller.Id);
            var reloadedStatusOk = Assert.IsType<OkObjectResult>(reloadedStatusResult);
            var reloadedStatus = Assert.IsType<SellerSubscriptionStatusDto>(
                reloadedStatusOk.Value);
            Assert.False(reloadedStatus.IsSubscribed);
        }

        private sealed class TestFixture : IDisposable
        {
            public const string ValidPassword = "TestPass123!";

            private readonly MarketplaceDbContext dbContext;
            private readonly IMapper mapper;

            public TestFixture()
            {
                var options = new DbContextOptionsBuilder<MarketplaceDbContext>()
                    .UseInMemoryDatabase(Guid.NewGuid().ToString())
                    .Options;

                dbContext = new MarketplaceDbContext(options);
                dbContext.Database.EnsureCreated();

                mapper = new MapperConfiguration(_ => { }).CreateMapper();
                UserManager = CreateUserManager(dbContext);
            }

            public UserManager<ApplicationUser> UserManager { get; }

            public async Task<ApplicationUser> CreateUserAsync(string email, string nickname)
            {
                var user = new ApplicationUser
                {
                    Id = Guid.NewGuid(),
                    UserName = email,
                    Email = email,
                    Nickname = nickname,
                    NormalizedNickname = nickname.ToUpperInvariant(),
                    NotifyEmailOnNewMessage = true,
                    NotifyEmailOnSellerOrder = true,
                    NotifyEmailOnFollowedSellerListing = true,
                    NotifyEmailOnLogin = true
                };

                var result = await UserManager.CreateAsync(user, ValidPassword);
                Assert.True(result.Succeeded);
                return user;
            }

            public UsersController CreateUsersController(
                Guid userId,
                INotificationEmailService notificationEmailService)
            {
                return new UsersController(
                    UserManager,
                    mapper,
                    new InMemoryEmailVerificationService(),
                    new ImmediateBackgroundNotificationQueue(notificationEmailService),
                    NullLogger<UsersController>.Instance)
                {
                    ControllerContext = CreateControllerContext(userId)
                };
            }

            public AuthController CreateAuthController(
                IBackgroundNotificationQueue backgroundNotificationQueue)
            {
                return new AuthController(
                    UserManager,
                    CreateSignInManager(UserManager),
                    new FakeTokenRepository(),
                    backgroundNotificationQueue,
                    new ConfigurationBuilder().Build(),
                    NullLogger<AuthController>.Instance)
                {
                    ControllerContext = new ControllerContext
                    {
                        HttpContext = new DefaultHttpContext()
                    }
                };
            }

            private static SignInManager<ApplicationUser> CreateSignInManager(
                UserManager<ApplicationUser> userManager)
            {
                var identityOptions = Options.Create(new IdentityOptions());
                var contextAccessor = new HttpContextAccessor
                {
                    HttpContext = new DefaultHttpContext()
                };
                var claimsFactory = new UserClaimsPrincipalFactory<ApplicationUser>(
                    userManager,
                    identityOptions);
                var schemes = new AuthenticationSchemeProvider(
                    Options.Create(new AuthenticationOptions()));

                return new SignInManager<ApplicationUser>(
                    userManager,
                    contextAccessor,
                    claimsFactory,
                    identityOptions,
                    NullLogger<SignInManager<ApplicationUser>>.Instance,
                    schemes,
                    new DefaultUserConfirmation<ApplicationUser>());
            }

            public SellerSubscriptionsController CreateSellerSubscriptionsController(
                Guid userId)
            {
                return new SellerSubscriptionsController(
                    new SellerSubscriptionRepository(dbContext),
                    UserManager)
                {
                    ControllerContext = CreateControllerContext(userId)
                };
            }

            public void Dispose()
            {
                UserManager.Dispose();
                dbContext.Dispose();
            }

            private static UserManager<ApplicationUser> CreateUserManager(
                MarketplaceDbContext dbContext)
            {
                var store = new UserStore<ApplicationUser, ApplicationRole, MarketplaceDbContext, Guid>(
                    dbContext);
                var identityOptions = new IdentityOptions
                {
                    Password = new PasswordOptions
                    {
                        RequireDigit = false,
                        RequireLowercase = false,
                        RequireNonAlphanumeric = false,
                        RequireUppercase = false,
                        RequiredLength = 6,
                        RequiredUniqueChars = 1
                    },
                    User = new UserOptions
                    {
                        RequireUniqueEmail = true
                    },
                    Tokens = new TokenOptions
                    {
                        ChangeEmailTokenProvider = TokenOptions.DefaultProvider
                    }
                };

                var userManager = new UserManager<ApplicationUser>(
                    store,
                    Options.Create(identityOptions),
                    new PasswordHasher<ApplicationUser>(),
                    new List<IUserValidator<ApplicationUser>>
                    {
                        new UserValidator<ApplicationUser>()
                    },
                    new List<IPasswordValidator<ApplicationUser>>
                    {
                        new PasswordValidator<ApplicationUser>()
                    },
                    new UpperInvariantLookupNormalizer(),
                    new IdentityErrorDescriber(),
                    null!,
                    NullLogger<UserManager<ApplicationUser>>.Instance);

                userManager.RegisterTokenProvider(
                    TokenOptions.DefaultProvider,
                    new FakeChangeEmailTokenProvider());

                return userManager;
            }

            private static ControllerContext CreateControllerContext(Guid userId)
            {
                var claims = new[]
                {
                    new System.Security.Claims.Claim(
                        System.Security.Claims.ClaimTypes.NameIdentifier,
                        userId.ToString())
                };
                var identity = new System.Security.Claims.ClaimsIdentity(claims, "Test");
                var principal = new System.Security.Claims.ClaimsPrincipal(identity);

                return new ControllerContext
                {
                    HttpContext = new DefaultHttpContext
                    {
                        User = principal
                    }
                };
            }
        }

        private sealed class FakeNotificationEmailService : INotificationEmailService
        {
            public int EmailChangeConfirmationCount { get; private set; }

            public int EmailChangeCodeCount { get; private set; }

            public Task SendEmailChangeConfirmationAsync(
                Guid userId,
                string toEmail,
                string? toName,
                string newEmail,
                string token)
            {
                EmailChangeConfirmationCount += 1;
                return Task.CompletedTask;
            }

            public Task SendFollowedSellerListingNotificationAsync(
                string toEmail,
                string? toName,
                string sellerName,
                string listingTitle,
                Guid listingId)
            {
                return Task.CompletedTask;
            }

            public Task SendListingRemovedByAdminNotificationAsync(
                string toEmail,
                string? toName,
                string listingTitle,
                Guid listingId,
                string? adminName)
            {
                return Task.CompletedTask;
            }

            public Task SendListingRemovedDueToCategoryDeletionAsync(
                string toEmail,
                string? toName,
                string listingTitle,
                Guid listingId,
                string categoryName,
                string? adminName)
            {
                return Task.CompletedTask;
            }

            public Task SendLoginNotificationAsync(
                string toEmail,
                string? toName,
                DateTime loggedAt,
                string? ipAddress,
                string? userAgent)
            {
                return Task.CompletedTask;
            }

            public Task SendNewMessageNotificationAsync(
                string toEmail,
                string? toName,
                string senderName,
                string messagePreview,
                Guid conversationId)
            {
                return Task.CompletedTask;
            }

            public Task SendSellerOrderNotificationAsync(
                string toEmail,
                string? toName,
                string buyerName,
                string listingTitle)
            {
                return Task.CompletedTask;
            }

            public Task SendPasswordResetAsync(
                string toEmail,
                string? toName,
                string newPassword)
            {
                return Task.CompletedTask;
            }

            public Task SendEmailVerificationCodeAsync(
                string toEmail,
                string? toName,
                string code)
            {
                return Task.CompletedTask;
            }

            public Task SendEmailChangeCodeAsync(
                string toEmail,
                string? toName,
                string newEmail,
                string code)
            {
                EmailChangeCodeCount += 1;
                return Task.CompletedTask;
            }
        }

        private sealed class FakeTokenRepository : ITokenRepository
        {
            public string CreateJWTToken(ApplicationUser user, List<string> roles)
            {
                return "token";
            }
        }

        private sealed class FakeBackgroundNotificationQueue
            : IBackgroundNotificationQueue
        {
            public int EnqueuedCount { get; private set; }

            public ValueTask QueueAsync(
                Func<INotificationEmailService, CancellationToken, Task> workItem)
            {
                EnqueuedCount += 1;
                return ValueTask.CompletedTask;
            }
        }

        private sealed class ImmediateBackgroundNotificationQueue
            : IBackgroundNotificationQueue
        {
            private readonly INotificationEmailService notificationEmailService;

            public ImmediateBackgroundNotificationQueue(
                INotificationEmailService notificationEmailService)
            {
                this.notificationEmailService = notificationEmailService;
            }

            public async ValueTask QueueAsync(
                Func<INotificationEmailService, CancellationToken, Task> workItem)
            {
                await workItem(notificationEmailService, CancellationToken.None);
            }
        }

        private sealed class FakeChangeEmailTokenProvider
            : IUserTwoFactorTokenProvider<ApplicationUser>
        {
            public Task<bool> CanGenerateTwoFactorTokenAsync(
                UserManager<ApplicationUser> manager,
                ApplicationUser user)
            {
                return Task.FromResult(false);
            }

            public Task<string> GenerateAsync(
                string purpose,
                UserManager<ApplicationUser> manager,
                ApplicationUser user)
            {
                return Task.FromResult($"token:{purpose}:{user.Id}");
            }

            public Task<bool> ValidateAsync(
                string purpose,
                string token,
                UserManager<ApplicationUser> manager,
                ApplicationUser user)
            {
                return Task.FromResult(token == $"token:{purpose}:{user.Id}");
            }
        }
    }
}
