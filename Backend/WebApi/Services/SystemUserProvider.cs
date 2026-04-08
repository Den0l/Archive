using Infrastructure.Identity;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;
using System;
using System.Threading.Tasks;

namespace WebApi.Services
{
    public class SystemUserProvider : ISystemUserProvider
    {
        private readonly UserManager<ApplicationUser> userManager;
        private readonly IConfiguration configuration;
        private readonly IWebHostEnvironment environment;

        public SystemUserProvider(
            UserManager<ApplicationUser> userManager,
            IConfiguration configuration,
            IWebHostEnvironment environment)
        {
            this.userManager = userManager;
            this.configuration = configuration;
            this.environment = environment;
        }

        public async Task<ApplicationUser> GetSystemUserAsync()
        {
            var email = GetValue("SystemUser:Email", "SYSTEM_USER_EMAIL");
            var nickname = GetValue("SystemUser:Nickname", "SYSTEM_USER_NICKNAME");
            var password = GetValue("SystemUser:Password", "SYSTEM_USER_PASSWORD");

            if (string.IsNullOrWhiteSpace(email) ||
                string.IsNullOrWhiteSpace(nickname) ||
                string.IsNullOrWhiteSpace(password))
            {
                if (environment.IsDevelopment())
                {
                    email ??= "system@archive.local";
                    nickname ??= "архив";
                    password ??= "ChangeMe123!";
                }
                else
                {
                    throw new InvalidOperationException(
                        "System user configuration is missing.");
                }
            }

            var existing = await userManager.FindByEmailAsync(email);
            if (existing != null)
            {
                return existing;
            }

            var systemUser = new ApplicationUser
            {
                UserName = email,
                Email = email,
                Nickname = nickname,
                EmailConfirmed = true
            };

            var result = await userManager.CreateAsync(systemUser, password);
            if (!result.Succeeded)
            {
                throw new InvalidOperationException(
                    $"Failed to create system user: {string.Join(", ", result.Errors)}");
            }

            return systemUser;
        }

        private string? GetValue(string configKey, string envKey)
        {
            var value = configuration[configKey];
            if (string.IsNullOrWhiteSpace(value))
            {
                value = Environment.GetEnvironmentVariable(envKey);
            }
            return string.IsNullOrWhiteSpace(value) ? null : value;
        }
    }
}
