using System.Text.RegularExpressions;

namespace WebApi.Services.ListingAi
{
    internal static class AiTextNormalization
    {
        public static string NormalizeForComparison(string value)
        {
            return Regex.Replace(
                value.Trim().ToLowerInvariant(),
                "\\s+",
                " ");
        }

        public static string NormalizeLoose(string value)
        {
            return Regex.Replace(
                NormalizeForComparison(value),
                "[^\\p{L}\\p{Nd}]+",
                string.Empty);
        }

        public static List<string> DeduplicateStrings(IEnumerable<string> values)
        {
            return values
                .Where(value => !string.IsNullOrWhiteSpace(value))
                .Select(value => value.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
        }
    }
}
