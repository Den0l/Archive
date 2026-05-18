using Infrastructure.Identity;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace WebApi.Services
{
    public class SystemUserProvider : ISystemUserProvider
    {
        private static readonly string[] DefaultSystemUserRoles = { "User", "Admin" };

        private readonly UserManager<ApplicationUser> userManager;
        private readonly RoleManager<ApplicationRole> roleManager;
        private readonly IConfiguration configuration;
        private readonly IWebHostEnvironment environment;

        public SystemUserProvider(
            UserManager<ApplicationUser> userManager,
            RoleManager<ApplicationRole> roleManager,
            IConfiguration configuration,
            IWebHostEnvironment environment)
        {
            this.userManager = userManager;
            this.roleManager = roleManager;
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
                await EnsureSystemUserCanSignInAsync(existing, email, nickname, password);
                return existing;
            }

            var normalizedNickname = userManager.NormalizeName(nickname.Trim());
            var systemUser = new ApplicationUser
            {
                UserName = email,
                Email = email,
                Nickname = nickname,
                NormalizedNickname = normalizedNickname,
                EmailConfirmed = true,
                NotifyEmailOnNewMessage = false,
                NotifyEmailOnSellerOrder = false,
                NotifyEmailOnFollowedSellerListing = false,
                NotifyEmailOnLogin = false
            };

            var result = await userManager.CreateAsync(systemUser, password);
            if (!result.Succeeded)
            {
                throw new InvalidOperationException(
                    $"Failed to create system user: {string.Join(", ", result.Errors)}");
            }

            await EnsureDefaultRolesAsync(systemUser);
            return systemUser;
        }

        private async Task EnsureSystemUserCanSignInAsync(
            ApplicationUser systemUser,
            string email,
            string nickname,
            string password)
        {
            var shouldUpdateUser = false;
            var normalizedNickname = userManager.NormalizeName(nickname.Trim());

            if (!string.Equals(systemUser.Email, email, StringComparison.Ordinal))
            {
                var setEmailResult = await userManager.SetEmailAsync(
                    systemUser,
                    email);
                EnsureSucceeded(setEmailResult, "Failed to update system user email.");
            }

            if (!string.Equals(systemUser.UserName, email, StringComparison.Ordinal))
            {
                var setUserNameResult = await userManager.SetUserNameAsync(
                    systemUser,
                    email);
                EnsureSucceeded(setUserNameResult, "Failed to update system user name.");
            }

            if (systemUser.Nickname != nickname)
            {
                systemUser.Nickname = nickname;
                shouldUpdateUser = true;
            }

            if (systemUser.NormalizedNickname != normalizedNickname)
            {
                systemUser.NormalizedNickname = normalizedNickname;
                shouldUpdateUser = true;
            }

            if (!systemUser.EmailConfirmed)
            {
                systemUser.EmailConfirmed = true;
                shouldUpdateUser = true;
            }

            if (systemUser.NotifyEmailOnNewMessage ||
                systemUser.NotifyEmailOnSellerOrder ||
                systemUser.NotifyEmailOnFollowedSellerListing ||
                systemUser.NotifyEmailOnLogin)
            {
                systemUser.NotifyEmailOnNewMessage = false;
                systemUser.NotifyEmailOnSellerOrder = false;
                systemUser.NotifyEmailOnFollowedSellerListing = false;
                systemUser.NotifyEmailOnLogin = false;
                shouldUpdateUser = true;
            }

            if (shouldUpdateUser)
            {
                var updateResult = await userManager.UpdateAsync(systemUser);
                EnsureSucceeded(updateResult, "Failed to update system user.");
            }

            if (await userManager.HasPasswordAsync(systemUser))
            {
                if (!await userManager.CheckPasswordAsync(systemUser, password))
                {
                    var resetToken = await userManager.GeneratePasswordResetTokenAsync(
                        systemUser);
                    var resetResult = await userManager.ResetPasswordAsync(
                        systemUser,
                        resetToken,
                        password);
                    EnsureSucceeded(
                        resetResult,
                        "Failed to reset system user password.");
                }
            }
            else
            {
                var addPasswordResult = await userManager.AddPasswordAsync(
                    systemUser,
                    password);
                EnsureSucceeded(
                    addPasswordResult,
                    "Failed to add system user password.");
            }

            await EnsureDefaultRolesAsync(systemUser);
        }

        private async Task EnsureDefaultRolesAsync(ApplicationUser user)
        {
            foreach (var roleName in DefaultSystemUserRoles)
            {
                await EnsureRoleAsync(user, roleName);
            }
        }

        private async Task EnsureRoleAsync(ApplicationUser user, string roleName)
        {
            if (!await roleManager.RoleExistsAsync(roleName))
            {
                var createRoleResult = await roleManager.CreateAsync(
                    new ApplicationRole
                    {
                        Name = roleName,
                        NormalizedName = roleName.ToUpperInvariant()
                    });
                EnsureSucceeded(createRoleResult, $"Failed to create {roleName} role.");
            }

            if (!await userManager.IsInRoleAsync(user, roleName))
            {
                var addToRoleResult = await userManager.AddToRoleAsync(user, roleName);
                EnsureSucceeded(
                    addToRoleResult,
                    $"Failed to add system user to {roleName} role.");
            }
        }

        private static void EnsureSucceeded(IdentityResult result, string message)
        {
            if (!result.Succeeded)
            {
                throw new InvalidOperationException(
                    $"{message} {string.Join(", ", result.Errors.Select(error => error.Description))}");
            }
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
