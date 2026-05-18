using Infrastructure;
using Infrastructure.Persistence.Contexts;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using System.Data;
using System.Text;
using System.Text.Json.Serialization;
using WebApi.Mappings;
using WebApi.Hubs;
using WebApi.Services;

LoadBackendEnvFile();
var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
var configuredOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins")
    .Get<string[]>() ?? Array.Empty<string>();
var allowedOrigins = configuredOrigins
    .Concat(new[]
    {
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://localhost:3000",
        "https://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "https://localhost:3001",
        "https://127.0.0.1:3001"
    })
    .Distinct(StringComparer.OrdinalIgnoreCase)
    .ToArray();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", corsBuilder =>
    {
        corsBuilder.SetIsOriginAllowed(origin =>
                   {
                       if (allowedOrigins.Contains(origin, StringComparer.OrdinalIgnoreCase))
                       {
                           return true;
                       }

                       if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri))
                       {
                           return false;
                       }

                       return uri.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase)
                           || uri.Host.Equals("127.0.0.1");
                   })
                   .AllowAnyHeader()
                   .AllowAnyMethod()
                   .AllowCredentials();
    });
});
builder.Services.AddControllers().AddJsonOptions(options => {
	// this is needed, otherwise api throws an exception, when two related objects reference each other
	options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
});
builder.Services.AddSignalR();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddScoped<IReceiptEmailService, SmtpReceiptEmailService>();
builder.Services.AddScoped<INotificationEmailService, SmtpNotificationEmailService>();
builder.Services.AddSingleton<BackgroundNotificationQueue>();
builder.Services.AddSingleton<IBackgroundNotificationQueue>(
    serviceProvider => serviceProvider.GetRequiredService<BackgroundNotificationQueue>());
builder.Services.AddHostedService(
    serviceProvider => serviceProvider.GetRequiredService<BackgroundNotificationQueue>());
builder.Services.AddScoped<ISystemUserProvider, SystemUserProvider>();
builder.Services.Configure<YandexAiOptions>(
    builder.Configuration.GetSection("YandexAi"));
builder.Services.AddHttpClient<IYandexAiClient, YandexAiClient>();
builder.Services.AddScoped<IListingAiAutofillService, ListingAiAutofillService>();
builder.Services.AddScoped<IListingViewTracker, ListingViewTracker>();
builder.Services.AddSingleton<IEmailVerificationService, InMemoryEmailVerificationService>();


builder.Services
    .AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
        options.DefaultScheme = JwtBearerDefaults.AuthenticationScheme;
    })
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]))
        };
        // so that it saves jwt data into context, so I can retrieve it in the hub
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];

                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) &&
                    path.StartsWithSegments("/chathub"))
                {
                    context.Token = accessToken;
                }

                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();

// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options => {
	options.SwaggerDoc("v1", new OpenApiInfo { Title = "MarketplaceAPI", Version = "v1" });
	options.AddSecurityDefinition(JwtBearerDefaults.AuthenticationScheme, new OpenApiSecurityScheme {
		Description = "Enter JWT token in format: Bearer {your token}",
		Name = "Authorization",
		In = ParameterLocation.Header,
		Type = SecuritySchemeType.Http,
		Scheme = JwtBearerDefaults.AuthenticationScheme,
		BearerFormat = "JWT"
	});
	options.AddSecurityRequirement(new OpenApiSecurityRequirement {
		{
			new OpenApiSecurityScheme {
				Reference = new OpenApiReference {
					Type = ReferenceType.SecurityScheme,
					Id = JwtBearerDefaults.AuthenticationScheme
				},
				Name = JwtBearerDefaults.AuthenticationScheme,
				In = ParameterLocation.Header
			},
			new List<string>()
		}
	});
});
builder.Services.AddAutoMapper(typeof(Mappings));
var app = builder.Build();

// Configure the HTTP request pipeline.
var swaggerEnabled =
	app.Environment.IsDevelopment() ||
	app.Configuration.GetValue<bool>("Swagger:Enabled");

if (swaggerEnabled) {
	app.UseSwagger();
	app.UseSwaggerUI(options =>
	{
		options.SwaggerEndpoint("/swagger/v1/swagger.json", "MarketplaceAPI v1");
		options.RoutePrefix = "swagger";
		options.EnablePersistAuthorization();
		options.DisplayRequestDuration();
	});
}


var imageContentTypeProvider = new FileExtensionContentTypeProvider();
imageContentTypeProvider.Mappings[".heic"] = "image/heic";
imageContentTypeProvider.Mappings[".heif"] = "image/heif";
imageContentTypeProvider.Mappings[".avif"] = "image/avif";
imageContentTypeProvider.Mappings[".jfif"] = "image/jpeg";
imageContentTypeProvider.Mappings[".webp"] = "image/webp";
imageContentTypeProvider.Mappings[".bmp"] = "image/bmp";

app.UseStaticFiles(new StaticFileOptions {
    FileProvider = new PhysicalFileProvider(Path.Combine(Directory.GetCurrentDirectory(), "Images")),
    RequestPath = "/Images", // routes from localhost/images to the physical path above
    ContentTypeProvider = imageContentTypeProvider
});
var aspNetCoreUrls = app.Configuration["ASPNETCORE_URLS"];
var kestrelHttpsUrl = app.Configuration["Kestrel:Endpoints:Https:Url"];
var hasHttpsEndpoint =
    (!string.IsNullOrWhiteSpace(aspNetCoreUrls) &&
     aspNetCoreUrls.Split(';', StringSplitOptions.RemoveEmptyEntries)
         .Any(url => url.TrimStart().StartsWith("https://", StringComparison.OrdinalIgnoreCase)))
    || !string.IsNullOrWhiteSpace(kestrelHttpsUrl);

if (hasHttpsEndpoint)
{
    app.UseHttpsRedirection();
}
app.UseCors("AllowFrontend"); 

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<ChatHub>("/chathub");

// Apply pending database migrations
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<MarketplaceDbContext>();
    var migrationLogger = scope.ServiceProvider
        .GetRequiredService<ILoggerFactory>()
        .CreateLogger("DatabaseMigrations");
    await RepairInvalidFirstMigrationMarkerAsync(dbContext, migrationLogger);
    await RestoreBaselineMigrationHistoryIfNeededAsync(dbContext, migrationLogger);
    await RepairPartiallyAppliedUpdateListingValidationRulesMigrationAsync(
        dbContext,
        migrationLogger);
    await dbContext.Database.MigrateAsync();
}

await BootstrapSystemUserAsync(app);
await BootstrapAdminAsync(app);

app.Run();

static async Task BootstrapSystemUserAsync(WebApplication application)
{
    using var scope = application.Services.CreateScope();
    var systemUserProvider = scope.ServiceProvider
        .GetRequiredService<ISystemUserProvider>();
    var bootstrapLogger = scope.ServiceProvider
        .GetRequiredService<ILoggerFactory>()
        .CreateLogger("BootstrapSystemUser");

    try
    {
        var systemUser = await systemUserProvider.GetSystemUserAsync();
        bootstrapLogger.LogInformation(
            "System user '{Email}' is ready for sign-in.",
            systemUser.Email);
    }
    catch (Exception exception)
    {
        bootstrapLogger.LogError(
            exception,
            "Failed to bootstrap system user.");
        throw;
    }
}

static async Task BootstrapAdminAsync(WebApplication application)
{
    var bootstrapEmail = application.Configuration["Bootstrap:AdminEmail"];
    if (string.IsNullOrWhiteSpace(bootstrapEmail))
    {
        return;
    }

    using var scope = application.Services.CreateScope();
    var userManager = scope.ServiceProvider
        .GetRequiredService<UserManager<Infrastructure.Identity.ApplicationUser>>();
    var bootstrapLogger = scope.ServiceProvider
        .GetRequiredService<ILoggerFactory>()
        .CreateLogger("BootstrapAdmin");

    var bootstrapUser = await userManager.FindByEmailAsync(bootstrapEmail);
    if (bootstrapUser == null)
    {
        bootstrapLogger.LogInformation(
            "Bootstrap admin user '{Email}' is not registered yet; will promote on next startup after they register.",
            bootstrapEmail);
        return;
    }

    if (await userManager.IsInRoleAsync(bootstrapUser, "Admin"))
    {
        return;
    }

    var addToRoleResult = await userManager.AddToRoleAsync(bootstrapUser, "Admin");
    if (addToRoleResult.Succeeded)
    {
        bootstrapLogger.LogInformation(
            "Promoted user '{Email}' to Admin via bootstrap configuration.",
            bootstrapEmail);
    }
    else
    {
        bootstrapLogger.LogWarning(
            "Failed to promote user '{Email}' to Admin: {Errors}",
            bootstrapEmail,
            string.Join("; ", addToRoleResult.Errors.Select(error => error.Description)));
    }
}

static async Task RestoreBaselineMigrationHistoryIfNeededAsync(
    MarketplaceDbContext dbContext,
    ILogger logger,
    CancellationToken cancellationToken = default)
{
    var appliedMigrations = await dbContext.Database
        .GetAppliedMigrationsAsync(cancellationToken);
    if (appliedMigrations.Any())
    {
        return;
    }

    var baselineMigrations = await GetAppliedBaselineMigrationsAsync(
        dbContext,
        cancellationToken);
    if (baselineMigrations.Count == 0)
    {
        if (await TableExistsAsync(dbContext, "AspNetRoles", cancellationToken))
        {
            logger.LogWarning(
                "Migration history is empty, but baseline migration schema detection did not find a complete known state. Automatic history restore was skipped.");
        }

        return;
    }

    logger.LogWarning(
        "Detected existing schema with empty migration history. Restoring baseline migration entries: {MigrationIds}",
        string.Join(", ", baselineMigrations.Select(m => m.MigrationId)));

    foreach (var migration in baselineMigrations)
    {
        await dbContext.Database.ExecuteSqlRawAsync(
            "INSERT IGNORE INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`) VALUES ({0}, {1});",
            new object[] { migration.MigrationId, migration.ProductVersion },
            cancellationToken);
    }
}

static async Task RepairInvalidFirstMigrationMarkerAsync(
    MarketplaceDbContext dbContext,
    ILogger logger,
    CancellationToken cancellationToken = default)
{
    const string firstMigrationId = "20250716082027_First migration";
    var appliedMigrations = await dbContext.Database
        .GetAppliedMigrationsAsync(cancellationToken);
    if (!appliedMigrations.Contains(firstMigrationId))
    {
        return;
    }

    var hasAnyCoreTables =
        await TableExistsAsync(dbContext, "AspNetRoles", cancellationToken) ||
        await TableExistsAsync(dbContext, "AspNetUsers", cancellationToken) ||
        await TableExistsAsync(dbContext, "Listings", cancellationToken) ||
        await TableExistsAsync(dbContext, "Categories", cancellationToken) ||
        await TableExistsAsync(dbContext, "Cities", cancellationToken) ||
        await TableExistsAsync(dbContext, "StateOfItem", cancellationToken);
    if (hasAnyCoreTables)
    {
        return;
    }

    logger.LogWarning(
        "Detected invalid migration marker: {MigrationId} exists in __EFMigrationsHistory, but core schema tables are missing. Clearing migration history to allow a clean migration replay.",
        firstMigrationId);

    await dbContext.Database.ExecuteSqlRawAsync(
        "DELETE FROM `__EFMigrationsHistory`;",
        cancellationToken);
}

static async Task RepairPartiallyAppliedUpdateListingValidationRulesMigrationAsync(
    MarketplaceDbContext dbContext,
    ILogger logger,
    CancellationToken cancellationToken = default)
{
    const string targetMigrationId = "20260412095612_UpdateListingValidationRules";
    var appliedMigrations = await dbContext.Database
        .GetAppliedMigrationsAsync(cancellationToken);
    if (appliedMigrations.Contains(targetMigrationId))
    {
        return;
    }

    var pendingMigrations = await dbContext.Database
        .GetPendingMigrationsAsync(cancellationToken);
    if (!pendingMigrations.Contains(targetMigrationId))
    {
        return;
    }

    if (!await CheckConstraintExistsAsync(
            dbContext,
            "Listings",
            "CK_Listings_Title_MinLength",
            cancellationToken))
    {
        return;
    }

    logger.LogWarning(
        "Detected partially applied migration {MigrationId}. Dropping existing check constraint CK_Listings_Title_MinLength before retrying migrations.",
        targetMigrationId);

    await dbContext.Database.ExecuteSqlRawAsync(
        "ALTER TABLE `Listings` DROP CONSTRAINT `CK_Listings_Title_MinLength`;",
        cancellationToken);
}

static async Task<List<(string MigrationId, string ProductVersion)>> GetAppliedBaselineMigrationsAsync(
    MarketplaceDbContext dbContext,
    CancellationToken cancellationToken)
{
    const string efProductVersion = "8.0.14";
    var baselineMigrations = new List<(string MigrationId, string ProductVersion)>();

    var hasFirstMigrationCoreSchema =
        await TableExistsAsync(dbContext, "AspNetRoles", cancellationToken) &&
        await TableExistsAsync(dbContext, "AspNetUsers", cancellationToken) &&
        await TableExistsAsync(dbContext, "Listings", cancellationToken) &&
        await TableExistsAsync(dbContext, "Categories", cancellationToken) &&
        await TableExistsAsync(dbContext, "Cities", cancellationToken) &&
        await TableExistsAsync(dbContext, "StateOfItem", cancellationToken);
    if (!hasFirstMigrationCoreSchema)
    {
        return baselineMigrations;
    }

    baselineMigrations.Add(("20250716082027_First migration", efProductVersion));

    if (await TableExistsAsync(dbContext, "CartItems", cancellationToken))
    {
        baselineMigrations.Add(("20260319095000_AddCartItems", efProductVersion));
    }

    if (!await ColumnExistsAsync(dbContext, "Listings", "ReasonOfSale", cancellationToken))
    {
        baselineMigrations.Add(("20260330153000_RemoveReasonOfSale", efProductVersion));
    }

    if (await TableExistsAsync(dbContext, "FavoriteItems", cancellationToken))
    {
        baselineMigrations.Add(("20260401120000_AddFavoriteItems", efProductVersion));
    }

    var hasOrdersMigrationSchema =
        await TableExistsAsync(dbContext, "Orders", cancellationToken) &&
        await ColumnExistsAsync(dbContext, "Listings", "IsArchived", cancellationToken);
    if (hasOrdersMigrationSchema)
    {
        baselineMigrations.Add(("20260404095441_AddOrdersAndListingArchive", efProductVersion));
    }

    if (await ColumnExistsAsync(dbContext, "AspNetUsers", "NormalizedNickname", cancellationToken))
    {
        baselineMigrations.Add(("20260406130000_AddNormalizedNickname", efProductVersion));
    }

    return baselineMigrations;
}

static Task<bool> TableExistsAsync(
    MarketplaceDbContext dbContext,
    string tableName,
    CancellationToken cancellationToken)
{
    var escapedTableName = EscapeSqlLiteral(tableName);
    return QueryExistsAsync(
        dbContext,
        $$"""
        SELECT COUNT(*)
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = '{{escapedTableName}}';
        """,
        cancellationToken);
}

static Task<bool> ColumnExistsAsync(
    MarketplaceDbContext dbContext,
    string tableName,
    string columnName,
    CancellationToken cancellationToken)
{
    var escapedTableName = EscapeSqlLiteral(tableName);
    var escapedColumnName = EscapeSqlLiteral(columnName);
    return QueryExistsAsync(
        dbContext,
        $$"""
        SELECT COUNT(*)
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = '{{escapedTableName}}'
          AND COLUMN_NAME = '{{escapedColumnName}}';
        """,
        cancellationToken);
}

static Task<bool> CheckConstraintExistsAsync(
    MarketplaceDbContext dbContext,
    string tableName,
    string constraintName,
    CancellationToken cancellationToken)
{
    var escapedTableName = EscapeSqlLiteral(tableName);
    var escapedConstraintName = EscapeSqlLiteral(constraintName);

    return QueryExistsAsync(
        dbContext,
        $$"""
        SELECT COUNT(*)
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE()
          AND TABLE_NAME = '{{escapedTableName}}'
          AND CONSTRAINT_NAME = '{{escapedConstraintName}}'
          AND CONSTRAINT_TYPE = 'CHECK';
        """,
        cancellationToken);
}

static async Task<bool> QueryExistsAsync(
    MarketplaceDbContext dbContext,
    string commandText,
    CancellationToken cancellationToken)
{
    var connection = dbContext.Database.GetDbConnection();
    var shouldCloseConnection = connection.State != ConnectionState.Open;

    if (shouldCloseConnection)
    {
        await connection.OpenAsync(cancellationToken);
    }

    try
    {
        await using var command = connection.CreateCommand();
        command.CommandText = commandText;

        var scalarResult = await command.ExecuteScalarAsync(cancellationToken);
        return Convert.ToInt32(scalarResult) > 0;
    }
    finally
    {
        if (shouldCloseConnection)
        {
            await connection.CloseAsync();
        }
    }
}

static string EscapeSqlLiteral(string value) => value.Replace("'", "''");

static void LoadBackendEnvFile()
{
    var keysLoadedFromEnvFiles = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
    var envFiles = ResolveEnvFiles();
    if (envFiles.Count == 0)
    {
        return;
    }

    foreach (var envFilePath in envFiles)
    {
        foreach (var rawLine in File.ReadAllLines(envFilePath))
        {
            var line = rawLine.Trim();
            if (string.IsNullOrWhiteSpace(line) || line.StartsWith('#'))
            {
                continue;
            }

            var separatorIndex = line.IndexOf('=');
            if (separatorIndex <= 0)
            {
                continue;
            }

            var key = line[..separatorIndex].Trim();
            if (string.IsNullOrWhiteSpace(key))
            {
                continue;
            }

            var existingValue = Environment.GetEnvironmentVariable(key);
            var hasExternalValue =
                !string.IsNullOrWhiteSpace(existingValue) &&
                !keysLoadedFromEnvFiles.Contains(key);
            if (hasExternalValue)
            {
                continue;
            }

            var value = line[(separatorIndex + 1)..].Trim().Trim('"');
            Environment.SetEnvironmentVariable(key, value);
            keysLoadedFromEnvFiles.Add(key);
        }
    }

    static List<string> ResolveEnvFiles()
    {
        var envFiles = new List<string>();
        var knownPaths = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        var currentDirectory = Directory.GetCurrentDirectory();
        var repoRoot = FindRepoRoot(currentDirectory);

        if (!string.IsNullOrWhiteSpace(repoRoot))
        {
            AddIfExists(Path.Combine(repoRoot, ".env"));
            AddIfExists(Path.Combine(repoRoot, ".env.local"));
            AddIfExists(Path.Combine(repoRoot, "Backend", "WebApi", ".env"));
            AddIfExists(Path.Combine(repoRoot, "Backend", "WebApi", ".env.local"));
        }

        AddIfExists(Path.Combine(currentDirectory, ".env"));
        AddIfExists(Path.Combine(currentDirectory, ".env.local"));
        AddIfExists(Path.Combine(AppContext.BaseDirectory, ".env"));
        AddIfExists(Path.Combine(AppContext.BaseDirectory, ".env.local"));

        return envFiles;

        void AddIfExists(string path)
        {
            var fullPath = Path.GetFullPath(path);
            if (!File.Exists(fullPath) || !knownPaths.Add(fullPath))
            {
                return;
            }

            envFiles.Add(fullPath);
        }
    }

    static string? FindRepoRoot(string startDirectory)
    {
        var directoryInfo = new DirectoryInfo(startDirectory);
        while (directoryInfo != null)
        {
            var composePath = Path.Combine(directoryInfo.FullName, "docker-compose.yml");
            if (File.Exists(composePath))
            {
                return directoryInfo.FullName;
            }

            directoryInfo = directoryInfo.Parent;
        }

        return null;
    }
}
