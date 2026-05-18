using System.Text.Json;
using System.Text.RegularExpressions;

namespace WebApi.Services.ListingAi
{
    internal static class AiResponseParser
    {
        private static readonly JsonSerializerOptions JsonOptions = new()
        {
            PropertyNameCaseInsensitive = true,
        };

        public static T ParseModelJson<T>(string rawResponse)
        {
            var sanitized = rawResponse.Trim();

            if (sanitized.StartsWith("```", StringComparison.Ordinal))
            {
                sanitized = Regex.Replace(
                    sanitized,
                    "^```(?:json)?\\s*|\\s*```$",
                    string.Empty,
                    RegexOptions.IgnoreCase | RegexOptions.Singleline);
            }

            var parsed = JsonSerializer.Deserialize<T>(sanitized, JsonOptions);
            if (parsed == null)
            {
                throw new JsonException("Empty JSON payload.");
            }

            return parsed;
        }
    }

    internal sealed class FirstPassAiResponse
    {
        public string? Title { get; set; }

        public string? Description { get; set; }

        public string? Category { get; set; }

        public string? State { get; set; }

        public List<string>? ObservedFacts { get; set; }
    }

    internal sealed class SecondPassAiResponse
    {
        public List<AiPropertySelection>? SelectedPropertyValues { get; set; }

        public List<string>? UnmatchedFacts { get; set; }
    }

    internal sealed class AiPropertySelection
    {
        public string? Property { get; set; }

        public string? Value { get; set; }
    }
}
