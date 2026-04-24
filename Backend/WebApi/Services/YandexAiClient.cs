using Microsoft.Extensions.Options;
using System.Text;
using System.Text.Json;

namespace WebApi.Services
{
    public sealed class YandexAiClient : IYandexAiClient
    {
        private readonly HttpClient httpClient;
        private readonly YandexAiOptions options;

        public YandexAiClient(
            HttpClient httpClient,
            IOptions<YandexAiOptions> options)
        {
            this.httpClient = httpClient;
            this.options = options.Value;
        }

        public async Task<string> GenerateTextAsync(
            string instructions,
            string prompt,
            IReadOnlyList<AiImagePayload> images,
            CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(options.ApiKey))
            {
                throw new InvalidOperationException("Yandex AI API key is not configured.");
            }

            if (string.IsNullOrWhiteSpace(options.FolderId))
            {
                throw new InvalidOperationException("Yandex AI folder id is not configured.");
            }

            var model = !string.IsNullOrWhiteSpace(options.Model)
                ? options.Model
                : $"gpt://{options.FolderId}/{options.DefaultVisionModel}";

            var content = new List<object>
            {
                new
                {
                    type = "text",
                    text = prompt,
                },
            };

            foreach (var image in images)
            {
                content.Add(new
                {
                    type = "image_url",
                    image_url = new
                    {
                        url = $"data:{image.ContentType};base64,{Convert.ToBase64String(image.Content)}",
                    },
                });
            }

            var messages = new List<object>();

            if (!string.IsNullOrWhiteSpace(instructions))
            {
                messages.Add(new
                {
                    role = "system",
                    content = instructions,
                });
            }

            messages.Add(new
            {
                role = "user",
                content = content.Cast<object>().ToArray(),
            });

            var requestBody = new
            {
                model,
                messages = messages.ToArray(),
            };

            using var request = new HttpRequestMessage(
                HttpMethod.Post,
                options.Endpoint);
            request.Headers.Add("Authorization", $"Api-Key {options.ApiKey}");
            request.Content = new StringContent(
                JsonSerializer.Serialize(requestBody),
                Encoding.UTF8,
                "application/json");

            using var response = await httpClient.SendAsync(
                request,
                cancellationToken);
            var responseBody = await response.Content.ReadAsStringAsync(
                cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                throw new InvalidOperationException(
                    ExtractErrorMessage(responseBody) ??
                    $"Yandex AI request failed with status {(int)response.StatusCode}.");
            }

            var outputText = ExtractOutputText(responseBody);
            if (string.IsNullOrWhiteSpace(outputText))
            {
                throw new InvalidOperationException(
                    ExtractErrorMessage(responseBody) ??
                    "Yandex AI returned an empty response.");
            }

            return outputText;
        }

        private static string? ExtractErrorMessage(string responseBody)
        {
            try
            {
                using var jsonDocument = JsonDocument.Parse(responseBody);
                var root = jsonDocument.RootElement;

                if (root.TryGetProperty("error", out var errorElement))
                {
                    if (errorElement.ValueKind == JsonValueKind.String)
                    {
                        return errorElement.GetString();
                    }

                    if (errorElement.TryGetProperty("message", out var messageElement))
                    {
                        return messageElement.GetString();
                    }
                }

                if (root.TryGetProperty("message", out var rootMessage))
                {
                    return rootMessage.GetString();
                }
            }
            catch
            {
                return string.IsNullOrWhiteSpace(responseBody)
                    ? null
                    : responseBody.Trim();
            }

            return string.IsNullOrWhiteSpace(responseBody)
                ? null
                : responseBody.Trim();
        }

        private static string ExtractOutputText(string responseBody)
        {
            using var jsonDocument = JsonDocument.Parse(responseBody);
            var root = jsonDocument.RootElement;

            if (!root.TryGetProperty("choices", out var choicesElement) ||
                choicesElement.ValueKind != JsonValueKind.Array)
            {
                return string.Empty;
            }

            var builder = new StringBuilder();

            foreach (var choice in choicesElement.EnumerateArray())
            {
                if (!choice.TryGetProperty("message", out var messageElement))
                {
                    continue;
                }

                if (!messageElement.TryGetProperty("content", out var contentElement))
                {
                    continue;
                }

                if (contentElement.ValueKind == JsonValueKind.String)
                {
                    if (builder.Length > 0)
                    {
                        builder.AppendLine();
                    }

                    builder.Append(contentElement.GetString());
                    continue;
                }

                if (contentElement.ValueKind != JsonValueKind.Array)
                {
                    continue;
                }

                foreach (var contentItem in contentElement.EnumerateArray())
                {
                    if (!contentItem.TryGetProperty("type", out var typeElement) ||
                        typeElement.ValueKind != JsonValueKind.String ||
                        !string.Equals(typeElement.GetString(), "text", StringComparison.OrdinalIgnoreCase))
                    {
                        continue;
                    }

                    if (!contentItem.TryGetProperty("text", out var textElement) ||
                        textElement.ValueKind != JsonValueKind.String)
                    {
                        continue;
                    }

                    if (builder.Length > 0)
                    {
                        builder.AppendLine();
                    }

                    builder.Append(textElement.GetString());
                }
            }

            return builder.ToString();
        }
    }
}
