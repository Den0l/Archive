namespace WebApi.Services
{
    public sealed record AiImagePayload(
        string FileName,
        string ContentType,
        byte[] Content);

    public interface IYandexAiClient
    {
        Task<string> GenerateTextAsync(
            string instructions,
            string prompt,
            IReadOnlyList<AiImagePayload> images,
            CancellationToken cancellationToken = default);
    }
}
