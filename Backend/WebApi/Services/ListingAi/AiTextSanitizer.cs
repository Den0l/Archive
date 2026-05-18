using System.Text.RegularExpressions;

namespace WebApi.Services.ListingAi
{
    internal static class AiTextSanitizer
    {
        private const int TitleMaxLength = 120;
        private const int DescriptionMaxLength = 2000;

        private static readonly string[] DescriptionLineMarkers =
        [
            "🔥",
            "🌸",
            "✅",
            "📌",
            "📏",
            "🎨",
            "🧵",
            "💫",
            "👌"
        ];

        private static readonly string[] PromptInjectionIndicators =
        [
            "забудь",
            "игнорируй",
            "игнорировать",
            "инструкц",
            "промпт",
            "системный промпт",
            "разработчик",
            "ассистент",
            "предыдущ",
            "сделай",
            "напиши",
            "ответь",
            "отвечай",
            "верни json",
            "markdown",
            "ignore",
            "forget",
            "disregard",
            "instruction",
            "prompt",
            "system",
            "developer",
            "assistant",
            "role:"
        ];

        private static readonly (string Key, Regex Pattern)[] DescriptionAttributePatterns =
        [
            ("brand", new Regex(@"^(?:бренд|марка|производитель)\b", RegexOptions.IgnoreCase | RegexOptions.Compiled)),
            ("color", new Regex(@"^(?:цвет|расцветка)\b", RegexOptions.IgnoreCase | RegexOptions.Compiled)),
            ("size", new Regex(@"^(?:размер|замеры|длина|ширина|обхват|ростовка)\b", RegexOptions.IgnoreCase | RegexOptions.Compiled)),
            ("material", new Regex(@"^(?:[\p{L}]{2,20}\s+){0,2}(?:материал|состав|ткань)\b", RegexOptions.IgnoreCase | RegexOptions.Compiled)),
            ("condition", new Regex(@"^(?:(?:без|есть|имеются)\s+)?(?:состояние|дефект|дефекты|износ|пятна|потертости|царапины)\b|^без\s+(?:дефектов|пятен|износа)", RegexOptions.IgnoreCase | RegexOptions.Compiled)),
            ("season", new Regex(@"^(?:сезон|подойд[её]т|подходит)\b", RegexOptions.IgnoreCase | RegexOptions.Compiled)),
            ("fit", new Regex(@"^(?:[\p{L}]{2,20}\s+){0,2}(?:посадка|крой|фасон|силуэт)\b", RegexOptions.IgnoreCase | RegexOptions.Compiled)),
            ("hardware", new Regex(@"^(?:[\p{L}]{2,20}\s+){0,2}(?:фурнитура|молния|пуговицы|заст[её]жка)\b", RegexOptions.IgnoreCase | RegexOptions.Compiled)),
            ("seams", new Regex(@"^(?:[\p{L}]{2,20}\s+){0,2}(?:швы|строчки)\b", RegexOptions.IgnoreCase | RegexOptions.Compiled)),
            ("set", new Regex(@"^(?:комплект|комплектация)\b", RegexOptions.IgnoreCase | RegexOptions.Compiled))
        ];

        private static readonly string[] ForbiddenTitleKeywords =
        [
            "размер",
            "size",
            "материал",
            "material",
            "состав",
            "condition",
            "состояние",
            "комплект",
            "комплектация",
            "характеристик",
            "параметр",
            "пол",
            "gender",
            "сезон",
            "season"
        ];

        private static readonly Regex DescriptionKnownLabelPrefixRegex = new(
            @"^(?:[-•—*]\s*)?(?:дополнительно|состояние|размер|материал|состав|комплект(?:ация)?|параметры|характеристики|цвет|бренд|модель|артикул)\s*[:\-]\s*",
            RegexOptions.IgnoreCase | RegexOptions.Compiled);

        private static readonly Regex DescriptionGenericLabelPrefixRegex = new(
            @"^(?:[-•—*]\s*)?[\p{L}]{2,25}(?:\s+[\p{L}]{2,25})?\s*:\s*",
            RegexOptions.Compiled);

        private static readonly Regex TitleDetailChunkRegex = new(
            @"(?i)\b(?:размер|size|материал|material|состав|condition|состояние|комплект(?:ация)?|пол|gender|сезон|season)\b\s*[:\-]?\s*[^,;|/]*",
            RegexOptions.Compiled);

        private static readonly Regex TitleSizeTokenRegex = new(
            @"(?i)\b(?:xxs|xs|s|m|l|xl|xxl|xxxl)\b|\b(?:eu|us|ru)\s*\d{1,3}\b|\b\d{2,3}\s*(?:р(?:азм(?:ер)?)?|size)\b|\b\d{2,3}\s*[-/]\s*\d{2,3}\b",
            RegexOptions.Compiled);

        public static string? BuildSafeDescriptionHint(string? descriptionHint)
        {
            if (string.IsNullOrWhiteSpace(descriptionHint))
            {
                return null;
            }

            var safeFacts = Regex
                .Split(descriptionHint, @"[\r\n;]+|(?<=[.!?])\s+")
                .Select(SanitizeDescriptionLine)
                .Where(line => !string.IsNullOrWhiteSpace(line))
                .Where(line => !LooksLikePromptInstruction(line))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Take(8)
                .ToList();

            return safeFacts.Count == 0
                ? null
                : string.Join(Environment.NewLine, safeFacts);
        }

        public static FirstPassAiResponse SanitizeFirstPassForFollowUp(
            FirstPassAiResponse firstPass)
        {
            var title = SanitizeDescriptionLine(firstPass.Title ?? string.Empty);

            return new FirstPassAiResponse
            {
                Title = LooksLikePromptInstruction(title) ? string.Empty : title,
                Description = BuildSafeDescriptionHint(firstPass.Description),
                Category = firstPass.Category,
                State = firstPass.State,
                ObservedFacts = BuildSafeFactLines(firstPass.ObservedFacts),
            };
        }

        public static string NormalizeTitle(
            string? title,
            string fallbackCategoryName,
            ICollection<string> warnings)
        {
            var normalized = (title ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(normalized))
            {
                normalized = fallbackCategoryName.Trim();
            }

            normalized = Regex.Replace(normalized, "\\s+", " ").Trim();

            var titleParts = Regex.Split(normalized, "\\s*[|;/]\\s*")
                .Select(CleanTitleFragment)
                .Where(part => !string.IsNullOrWhiteSpace(part))
                .Where(part => !ContainsForbiddenTitleDetails(part))
                .ToList();

            if (titleParts.Count > 0)
            {
                normalized = string.Join(" ", titleParts);
            }
            else
            {
                normalized = CleanTitleFragment(normalized);
            }

            normalized = Regex.Replace(normalized, "\\s+", " ")
                .Trim(' ', ',', ';', ':', '-', '|', '/');

            if (normalized.Length < 3)
            {
                normalized = fallbackCategoryName.Trim();
            }

            if (normalized.Length > TitleMaxLength)
            {
                normalized = normalized[..TitleMaxLength].Trim();
                warnings.Add("AI сократил название до допустимой длины.");
            }

            return normalized;
        }

        public static string BuildDescription(
            string? aiDescription,
            string? descriptionHint,
            IReadOnlyCollection<string> unmatchedFacts,
            ICollection<string> warnings)
        {
            var lines = new List<string>();

            AddDistinctParagraphs(lines, aiDescription);
            AddDistinctParagraphs(lines, descriptionHint);

            var cleanedFacts = AiTextNormalization.DeduplicateStrings(unmatchedFacts)
                .Select(SanitizeDescriptionLine)
                .Where(fact => !string.IsNullOrWhiteSpace(fact))
                .ToList();

            if (cleanedFacts.Count > 0)
            {
                foreach (var fact in cleanedFacts)
                {
                    AddDistinctParagraphs(lines, fact);
                }
            }

            var description = string.Join(
                    Environment.NewLine,
                    FormatAvitoDescriptionLines(lines))
                .Trim();

            if (description.Length > DescriptionMaxLength)
            {
                description = description[..DescriptionMaxLength].Trim();
                warnings.Add("AI сократил описание до допустимой длины.");
            }

            return description;
        }

        private static List<string> BuildSafeFactLines(IEnumerable<string>? facts)
        {
            return AiTextNormalization.DeduplicateStrings(facts ?? [])
                .Select(SanitizeDescriptionLine)
                .Where(fact => !string.IsNullOrWhiteSpace(fact))
                .Where(fact => !LooksLikePromptInstruction(fact))
                .Take(12)
                .ToList();
        }

        private static List<string> FormatAvitoDescriptionLines(
            IReadOnlyList<string> lines)
        {
            var formattedLines = new List<string>();

            foreach (var rawLine in lines)
            {
                var line = rawLine.Trim();
                if (string.IsNullOrWhiteSpace(line))
                {
                    continue;
                }

                if (StartsWithDescriptionMarker(line))
                {
                    formattedLines.Add(line);
                    continue;
                }

                if (formattedLines.Count == 0)
                {
                    formattedLines.Add($"🔥 {line.ToUpperInvariant()}");
                    continue;
                }

                formattedLines.Add($"✅ {line}");
            }

            return formattedLines;
        }

        private static bool StartsWithDescriptionMarker(string line)
        {
            return DescriptionLineMarkers.Any(marker =>
                line.StartsWith(marker, StringComparison.Ordinal));
        }

        private static void AddDistinctParagraphs(
            ICollection<string> target,
            string? source)
        {
            if (string.IsNullOrWhiteSpace(source))
            {
                return;
            }

            var existingFacts = new HashSet<string>(
                target.Select(NormalizeDescriptionFactKey),
                StringComparer.OrdinalIgnoreCase);
            var existingAttributes = new HashSet<string>(
                target.Select(GetDescriptionAttributeKey)
                    .OfType<string>(),
                StringComparer.OrdinalIgnoreCase);

            var paragraphs = source
                .Split(["\r\n", "\n", ";"], StringSplitOptions.RemoveEmptyEntries)
                .Select(SanitizeDescriptionLine)
                .Where(part => !string.IsNullOrWhiteSpace(part))
                .Distinct(StringComparer.OrdinalIgnoreCase);

            foreach (var paragraph in paragraphs)
            {
                if (LooksLikePromptInstruction(paragraph))
                {
                    continue;
                }

                var factKey = NormalizeDescriptionFactKey(paragraph);
                if (string.IsNullOrWhiteSpace(factKey))
                {
                    continue;
                }

                if (!existingFacts.Add(factKey))
                {
                    continue;
                }

                var attributeKey = GetDescriptionAttributeKey(paragraph);
                if (!string.IsNullOrWhiteSpace(attributeKey) &&
                    !existingAttributes.Add(attributeKey))
                {
                    continue;
                }

                target.Add(paragraph);
            }
        }

        private static bool LooksLikePromptInstruction(string line)
        {
            var normalized = AiTextNormalization.NormalizeForComparison(line);
            if (normalized.Contains("```") ||
                normalized.Contains("<system") ||
                normalized.Contains("</system") ||
                normalized.Contains("{") ||
                normalized.Contains("}"))
            {
                return true;
            }

            return PromptInjectionIndicators.Any(indicator =>
                normalized.Contains(indicator, StringComparison.OrdinalIgnoreCase));
        }

        private static string NormalizeDescriptionFactKey(string line)
        {
            var cleaned = StripDescriptionLineDecorations(line);
            cleaned = DescriptionKnownLabelPrefixRegex.Replace(cleaned, string.Empty);
            cleaned = Regex.Replace(cleaned, @"[^\p{L}\p{Nd}]+", " ");
            return AiTextNormalization.NormalizeForComparison(cleaned);
        }

        private static string? GetDescriptionAttributeKey(string line)
        {
            var cleaned = StripDescriptionLineDecorations(line);
            foreach (var (key, pattern) in DescriptionAttributePatterns)
            {
                if (pattern.IsMatch(cleaned))
                {
                    return key;
                }
            }

            return null;
        }

        private static string StripDescriptionLineDecorations(string line)
        {
            var cleaned = line.Trim();
            foreach (var marker in DescriptionLineMarkers)
            {
                if (cleaned.StartsWith(marker, StringComparison.Ordinal))
                {
                    cleaned = cleaned[marker.Length..].Trim();
                    break;
                }
            }

            return cleaned.TrimStart('-', '•', '—', '*').Trim();
        }

        private static bool ContainsForbiddenTitleDetails(string titleFragment)
        {
            var normalized = AiTextNormalization.NormalizeForComparison(titleFragment);
            return ForbiddenTitleKeywords.Any(keyword => normalized.Contains(keyword));
        }

        private static string CleanTitleFragment(string rawTitleFragment)
        {
            if (string.IsNullOrWhiteSpace(rawTitleFragment))
            {
                return string.Empty;
            }

            var cleaned = rawTitleFragment.Trim();

            cleaned = Regex.Replace(cleaned, "\\([^)]*\\)", " ");
            cleaned = Regex.Replace(cleaned, "\\[[^\\]]*\\]", " ");
            cleaned = DescriptionKnownLabelPrefixRegex.Replace(cleaned, string.Empty);
            cleaned = DescriptionGenericLabelPrefixRegex.Replace(cleaned, string.Empty);
            cleaned = TitleDetailChunkRegex.Replace(cleaned, " ");
            cleaned = TitleSizeTokenRegex.Replace(cleaned, " ");

            cleaned = Regex.Replace(cleaned, "\\s+", " ")
                .Trim(' ', ',', ';', ':', '-', '|', '/');

            return cleaned;
        }

        private static string SanitizeDescriptionLine(string rawLine)
        {
            if (string.IsNullOrWhiteSpace(rawLine))
            {
                return string.Empty;
            }

            var cleaned = rawLine.Trim();
            cleaned = cleaned.TrimStart('-', '•', '—', '*').Trim();
            cleaned = CollapseRepeatedWords(cleaned);
            cleaned = Regex.Replace(
                cleaned,
                @"^(?:дополнительно|описание|особенности|характеристики)\s*[:\-]\s*",
                string.Empty,
                RegexOptions.IgnoreCase);

            cleaned = CollapseRepeatedWords(cleaned);
            cleaned = Regex.Replace(cleaned, "\\s+", " ")
                .Trim(' ', ',', ';', ':', '-', '|', '/');

            return cleaned;
        }

        private static string CollapseRepeatedWords(string value)
        {
            return Regex.Replace(
                value,
                @"\b([\p{L}\p{Nd}]{2,})\b(?:\s+\1\b)+",
                "$1",
                RegexOptions.IgnoreCase);
        }
    }
}
