using Infrastructure.Identity;
using System.Threading.Tasks;

namespace WebApi.Services
{
    public interface ISystemUserProvider
    {
        Task<ApplicationUser> GetSystemUserAsync();
    }
}
