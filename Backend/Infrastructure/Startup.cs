using Application.Interfaces.Repositories;
using Infrastructure.FileStorage.Interfaces;
using Infrastructure.Identity;
using Infrastructure.Identity.Interfaces;
using Infrastructure.ImageProcessing;
using Infrastructure.ImageProcessing.Interfaces;
using Infrastructure.ImageProcessing.Services;
using Infrastructure.Persistence.Contexts;
using Infrastructure.Persistence.Repositories;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Infrastructure
{
    /// <summary>
    /// Setup of dependency injections, the methods are called from Program.cs in WebApi
    /// </summary>
    public static class Startup
    {
        public static IServiceCollection AddInfrastructure(
            this IServiceCollection services,
            IConfiguration configuration)
        {
            var host = Environment.GetEnvironmentVariable("MYSQL_HOST");
            var database = Environment.GetEnvironmentVariable("MYSQL_DATABASE");
            var user = Environment.GetEnvironmentVariable("MYSQL_USER");
            var password = Environment.GetEnvironmentVariable("MYSQL_PASSWORD");
            var connectionString =
                $"server={host};user={user};database={database};password={password};";
            var serverVersion = new MySqlServerVersion(new Version(8, 0, 34));

            var serviceCollection = services
                .AddDbContext<MarketplaceDbContext>(dbContextOptions =>
                    dbContextOptions
                        .UseMySql(
                            connectionString,
                            serverVersion,
                            options => options
                                .UseNetTopologySuite()
                                .EnableRetryOnFailure(
                                    maxRetryCount: 5,
                                    maxRetryDelay: TimeSpan.FromSeconds(10),
                                    errorNumbersToAdd: null))
                        .LogTo(Console.WriteLine, LogLevel.Information)
                        .EnableSensitiveDataLogging()
                        .EnableDetailedErrors())
                .AddScoped<IListingRepository, ListingRepository>()
                .AddScoped<IListingPropertyRepository, ListingPropertyRepository>()
                .AddScoped<ICategoryRepository, CategoryRepository>()
                .AddScoped<IListingPropertyValueRepository, ListingPropertyValueRepository>()
                .AddScoped<IImageRepository, ImageRepository>()
                .AddScoped<ITokenRepository, TokenRepository>()
                .AddScoped<IStateOfItemRepository, StateOfItemRepository>()
                .AddScoped<ICartRepository, CartRepository>()
                .AddScoped<IFavoriteRepository, FavoriteRepository>()
                .AddScoped<IConversationRepository, ConversationRepository>()
                .AddScoped<IMessageRepository, MessageRepository>()
                .AddScoped<IOrderRepository, OrderRepository>()
                .AddScoped<ISellerSubscriptionRepository, SellerSubscriptionRepository>()
                .AddScoped<ICityRepository, CityRepository>()
                .AddScoped<IReviewRepository, ReviewRepository>()
                .AddHttpContextAccessor()
                .AddIdentity();

            serviceCollection.Configure<RembgOptions>(
                configuration.GetSection(RembgOptions.SectionName));
            serviceCollection.AddHttpClient<
                IBackgroundRemovalService,
                RembgBackgroundRemovalService>((serviceProvider, httpClient) =>
            {
                var options = serviceProvider
                    .GetRequiredService<IOptions<RembgOptions>>()
                    .Value;
                if (options.TimeoutSeconds > 0)
                {
                    httpClient.Timeout = TimeSpan.FromSeconds(options.TimeoutSeconds);
                }
            });

            return serviceCollection;
        }

        public static IServiceCollection AddIdentity(this IServiceCollection services)
        {
            return services
                .AddIdentity<ApplicationUser, ApplicationRole>(options =>
                {
                    options.Password.RequireDigit = false;
                    options.Password.RequireLowercase = false;
                    options.Password.RequireNonAlphanumeric = false;
                    options.Password.RequireUppercase = false;
                    options.Password.RequiredLength = 6;
                    options.Password.RequiredUniqueChars = 1;
                    options.User.RequireUniqueEmail = true;
                })
                .AddTokenProvider<DataProtectorTokenProvider<ApplicationUser>>(
                    "Marketplace")
                .AddEntityFrameworkStores<MarketplaceDbContext>()
                .AddDefaultTokenProviders().Services;
        }
    }
}
