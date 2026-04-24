using Infrastructure;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
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


app.UseStaticFiles(new StaticFileOptions {
	FileProvider = new PhysicalFileProvider(Path.Combine(Directory.GetCurrentDirectory(), "Images")),
	RequestPath = "/Images" //routes from localhost/images to the physical path above
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

app.Run();

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
