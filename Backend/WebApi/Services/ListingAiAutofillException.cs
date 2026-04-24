namespace WebApi.Services
{
    public sealed class ListingAiAutofillException : Exception
    {
        public int StatusCode { get; }

        public ListingAiAutofillException(int statusCode, string message)
            : base(message)
        {
            StatusCode = statusCode;
        }
    }
}
