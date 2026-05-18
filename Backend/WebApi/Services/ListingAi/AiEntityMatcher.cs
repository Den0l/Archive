using Domain.Entities;
using Microsoft.AspNetCore.Http;
using WebApi.ApiDtos.Listings;

namespace WebApi.Services.ListingAi
{
    internal sealed record CategoryCandidate(
        Guid Id,
        Category Category,
        string Path);

    internal static class AiEntityMatcher
    {
        public static List<CategoryCandidate> BuildCategoryCandidates(
            IReadOnlyList<Category> categories)
        {
            var categoriesById = categories.ToDictionary(category => category.Id);

            return categories
                .Select(category => new CategoryCandidate(
                    category.Id,
                    category,
                    BuildCategoryPath(category, categoriesById)))
                .ToList();
        }

        public static CategoryCandidate MatchCategory(
            string? rawCategory,
            IReadOnlyList<CategoryCandidate> categoryCandidates,
            ICollection<string> warnings)
        {
            if (string.IsNullOrWhiteSpace(rawCategory))
            {
                throw new ListingAiAutofillException(
                    StatusCodes.Status502BadGateway,
                    "AI не определил категорию объявления.");
            }

            var normalizedCategory = AiTextNormalization.NormalizeForComparison(rawCategory);
            var exactPathMatch = categoryCandidates
                .FirstOrDefault(candidate =>
                    AiTextNormalization.NormalizeForComparison(candidate.Path) == normalizedCategory);
            if (exactPathMatch != null)
            {
                return exactPathMatch;
            }

            var exactLeafMatches = categoryCandidates
                .Where(candidate =>
                    AiTextNormalization.NormalizeForComparison(candidate.Category.Name) == normalizedCategory)
                .ToList();
            if (exactLeafMatches.Count == 1)
            {
                warnings.Add(
                    $"AI выбрал категорию по названию без полного пути: {exactLeafMatches[0].Path}.");
                return exactLeafMatches[0];
            }

            var softMatches = categoryCandidates
                .Where(candidate =>
                    AiTextNormalization.NormalizeLoose(candidate.Path) == AiTextNormalization.NormalizeLoose(rawCategory) ||
                    AiTextNormalization.NormalizeLoose(candidate.Category.Name) == AiTextNormalization.NormalizeLoose(rawCategory) ||
                    AiTextNormalization.NormalizeLoose(candidate.Path).Contains(AiTextNormalization.NormalizeLoose(rawCategory)) ||
                    AiTextNormalization.NormalizeLoose(rawCategory).Contains(AiTextNormalization.NormalizeLoose(candidate.Path)) ||
                    AiTextNormalization.NormalizeLoose(candidate.Category.Name).Contains(AiTextNormalization.NormalizeLoose(rawCategory)) ||
                    AiTextNormalization.NormalizeLoose(rawCategory).Contains(AiTextNormalization.NormalizeLoose(candidate.Category.Name)))
                .ToList();

            if (softMatches.Count == 1)
            {
                warnings.Add(
                    $"AI выбрал категорию по близкому совпадению: {rawCategory} -> {softMatches[0].Path}.");
                return softMatches[0];
            }

            throw new ListingAiAutofillException(
                StatusCodes.Status502BadGateway,
                "AI не смог выбрать корректную категорию из доступного списка.");
        }

        public static T MatchByName<T>(
            string? rawValue,
            IReadOnlyList<T> candidates,
            Func<T, string> getName,
            string label,
            ICollection<string> warnings)
        {
            if (string.IsNullOrWhiteSpace(rawValue))
            {
                throw new ListingAiAutofillException(
                    StatusCodes.Status502BadGateway,
                    $"AI не определил поле «{label}».");
            }

            var normalizedValue = AiTextNormalization.NormalizeForComparison(rawValue);
            var exactMatch = candidates
                .FirstOrDefault(candidate =>
                    AiTextNormalization.NormalizeForComparison(getName(candidate)) == normalizedValue);
            if (exactMatch != null)
            {
                return exactMatch;
            }

            var softMatches = candidates
                .Where(candidate =>
                    AiTextNormalization.NormalizeLoose(getName(candidate)) == AiTextNormalization.NormalizeLoose(rawValue) ||
                    AiTextNormalization.NormalizeLoose(getName(candidate)).Contains(AiTextNormalization.NormalizeLoose(rawValue)) ||
                    AiTextNormalization.NormalizeLoose(rawValue).Contains(AiTextNormalization.NormalizeLoose(getName(candidate))))
                .ToList();

            if (softMatches.Count == 1)
            {
                warnings.Add(
                    $"AI выбрал поле «{label}» по близкому совпадению: {rawValue} -> {getName(softMatches[0])}.");
                return softMatches[0];
            }

            throw new ListingAiAutofillException(
                StatusCodes.Status502BadGateway,
                $"AI не смог выбрать корректное значение для поля «{label}».");
        }

        public static List<ListingPropertyValueSelectionDto> MatchPropertySelections(
            IReadOnlyList<AiPropertySelection>? selectedPropertyValues,
            IReadOnlyList<ListingProperty> listingProperties,
            ICollection<string> warnings,
            ICollection<string> unmatchedFacts)
        {
            var propertySelections = new List<ListingPropertyValueSelectionDto>();
            var matchedPropertyIds = new HashSet<Guid>();

            foreach (var selection in selectedPropertyValues ?? [])
            {
                if (string.IsNullOrWhiteSpace(selection.Property) ||
                    string.IsNullOrWhiteSpace(selection.Value))
                {
                    continue;
                }

                var matchedProperty = TryMatchByName(
                    selection.Property,
                    listingProperties,
                    property => property.Name);

                if (matchedProperty == null)
                {
                    unmatchedFacts.Add($"{selection.Property}: {selection.Value}");
                    continue;
                }

                if (!matchedPropertyIds.Add(matchedProperty.Id))
                {
                    continue;
                }

                var matchedValue = TryMatchByName(
                    selection.Value,
                    matchedProperty.ListingPropertyValues,
                    value => value.Name);

                if (matchedValue == null)
                {
                    unmatchedFacts.Add($"{matchedProperty.Name}: {selection.Value}");
                    continue;
                }

                propertySelections.Add(new ListingPropertyValueSelectionDto
                {
                    ListingPropertyId = matchedProperty.Id,
                    SelectedListingPropertyValueId = matchedValue.Id,
                });
            }

            if (unmatchedFacts.Count > 0)
            {
                warnings.Add(
                    "Часть характеристик не удалось подобрать из справочников. Эти факты добавлены в описание.");
            }

            return propertySelections;
        }

        private static string BuildCategoryPath(
            Category category,
            IReadOnlyDictionary<Guid, Category> categoriesById)
        {
            var pathSegments = new Stack<string>();
            var current = category;

            while (true)
            {
                pathSegments.Push(current.Name.Trim());

                if (!current.ParentCategoryId.HasValue ||
                    !categoriesById.TryGetValue(
                        current.ParentCategoryId.Value,
                        out var parentCategory))
                {
                    break;
                }

                current = parentCategory;
            }

            return string.Join(" / ", pathSegments);
        }

        private static T? TryMatchByName<T>(
            string rawValue,
            IReadOnlyList<T> candidates,
            Func<T, string> getName)
            where T : class
        {
            var normalizedValue = AiTextNormalization.NormalizeForComparison(rawValue);
            var exactMatch = candidates
                .FirstOrDefault(candidate =>
                    AiTextNormalization.NormalizeForComparison(getName(candidate)) == normalizedValue);
            if (exactMatch != null)
            {
                return exactMatch;
            }

            var softMatches = candidates
                .Where(candidate =>
                    AiTextNormalization.NormalizeLoose(getName(candidate)) == AiTextNormalization.NormalizeLoose(rawValue) ||
                    AiTextNormalization.NormalizeLoose(getName(candidate)).Contains(AiTextNormalization.NormalizeLoose(rawValue)) ||
                    AiTextNormalization.NormalizeLoose(rawValue).Contains(AiTextNormalization.NormalizeLoose(getName(candidate))))
                .ToList();

            return softMatches.Count == 1 ? softMatches[0] : null;
        }
    }
}
