using System.Net.Http.Headers;
using System.Text.Json;
using Infrastructure.ImageProcessing.Interfaces;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Infrastructure.ImageProcessing.Services
{
    public sealed class RembgBackgroundRemovalService : IBackgroundRemovalService
    {
        private readonly HttpClient httpClient;
        private readonly ILogger<RembgBackgroundRemovalService> logger;
        private readonly RembgOptions options;

        public RembgBackgroundRemovalService(
            HttpClient httpClient,
            IOptions<RembgOptions> options,
            ILogger<RembgBackgroundRemovalService> logger)
        {
            this.httpClient = httpClient;
            this.logger = logger;
            this.options = options.Value;
        }

        public async Task<byte[]> RemoveBackgroundAsync(
            byte[] sourceImage,
            CancellationToken cancellationToken = default)
        {
            if (sourceImage.Length == 0)
            {
                throw new InvalidOperationException(
                    "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u0431\u0440\u0430\u0431\u043e\u0442\u0430\u0442\u044c \u043f\u0443\u0441\u0442\u043e\u0435 \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u0435.");
            }

            if (string.IsNullOrWhiteSpace(options.Endpoint))
            {
                throw new InvalidOperationException(
                    "\u041d\u0435 \u043d\u0430\u0441\u0442\u0440\u043e\u0435\u043d \u0430\u0434\u0440\u0435\u0441 \u0441\u0435\u0440\u0432\u0438\u0441\u0430 \u0443\u0434\u0430\u043b\u0435\u043d\u0438\u044f \u0444\u043e\u043d\u0430.");
            }

            using var requestContent = new MultipartFormDataContent();
            using var fileContent = new ByteArrayContent(sourceImage);
            fileContent.Headers.ContentType = new MediaTypeHeaderValue(
                "application/octet-stream");
            requestContent.Add(fileContent, "file", "image");

            using var request = new HttpRequestMessage(
                HttpMethod.Post,
                options.Endpoint)
            {
                Content = requestContent,
            };

            using var response = await httpClient.SendAsync(
                request,
                HttpCompletionOption.ResponseHeadersRead,
                cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                var errorBody = await response.Content.ReadAsStringAsync(
                    cancellationToken);
                var errorMessage = ExtractErrorMessage(errorBody);
                logger.LogWarning(
                    "Rembg request failed with status {StatusCode}: {ErrorMessage}",
                    (int)response.StatusCode,
                    errorMessage ?? "<empty>");

                throw new InvalidOperationException(
                    errorMessage ??
                    $"\u0421\u0435\u0440\u0432\u0438\u0441 \u0443\u0434\u0430\u043b\u0435\u043d\u0438\u044f \u0444\u043e\u043d\u0430 \u0432\u0435\u0440\u043d\u0443\u043b \u043e\u0448\u0438\u0431\u043a\u0443 {(int)response.StatusCode}.");
            }

            var result = await response.Content.ReadAsByteArrayAsync(cancellationToken);
            if (result.Length == 0)
            {
                throw new InvalidOperationException(
                    "\u0421\u0435\u0440\u0432\u0438\u0441 \u0443\u0434\u0430\u043b\u0435\u043d\u0438\u044f \u0444\u043e\u043d\u0430 \u0432\u0435\u0440\u043d\u0443\u043b \u043f\u0443\u0441\u0442\u043e\u0439 \u043e\u0442\u0432\u0435\u0442.");
            }

            return result;
        }

        private static string? ExtractErrorMessage(string responseBody)
        {
            if (string.IsNullOrWhiteSpace(responseBody))
            {
                return null;
            }

            try
            {
                using var jsonDocument = JsonDocument.Parse(responseBody);
                var root = jsonDocument.RootElement;

                if (root.TryGetProperty("detail", out var detailElement))
                {
                    return ExtractElementMessage(detailElement);
                }

                if (root.TryGetProperty("message", out var messageElement))
                {
                    return ExtractElementMessage(messageElement);
                }

                if (root.TryGetProperty("error", out var errorElement))
                {
                    return ExtractElementMessage(errorElement);
                }
            }
            catch (JsonException)
            {
                return responseBody.Trim();
            }

            return responseBody.Trim();
        }

        private static string? ExtractElementMessage(JsonElement element)
        {
            switch (element.ValueKind)
            {
                case JsonValueKind.String:
                    return element.GetString();
                case JsonValueKind.Array:
                    var messages = element
                        .EnumerateArray()
                        .Select(ExtractElementMessage)
                        .Where(message => !string.IsNullOrWhiteSpace(message))
                        .ToArray();
                    return messages.Length == 0
                        ? null
                        : string.Join(" ", messages);
                case JsonValueKind.Object:
                    if (element.TryGetProperty("message", out var messageElement))
                    {
                        return ExtractElementMessage(messageElement);
                    }

                    if (element.TryGetProperty("detail", out var detailElement))
                    {
                        return ExtractElementMessage(detailElement);
                    }

                    if (element.TryGetProperty("error", out var errorElement))
                    {
                        return ExtractElementMessage(errorElement);
                    }

                    return element.ToString();
                default:
                    return element.ToString();
            }
        }
    }
}
