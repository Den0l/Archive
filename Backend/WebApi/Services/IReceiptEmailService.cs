using System.Threading.Tasks;
using WebApi.ApiDtos.Checkout;

namespace WebApi.Services
{
    public interface IReceiptEmailService
    {
        Task SendReceiptAsync(string toEmail, string? toName, CheckoutRequest request);
    }
}
