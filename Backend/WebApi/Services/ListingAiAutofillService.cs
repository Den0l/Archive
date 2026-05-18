using Application.Interfaces.Repositories;
using Infrastructure.FileStorage.Interfaces;
using Microsoft.AspNetCore.Http;
using WebApi.ApiDtos.Listings;
using WebApi.Services.ListingAi;

namespace WebApi.Services
{
    public sealed class ListingAiAutofillService : IListingAiAutofillService
    {
        private readonly ICategoryRepository categoryRepository;
        private readonly IStateOfItemRepository stateOfItemRepository;
        private readonly IYandexAiClient yandexAiClient;
        private readonly ILogger<ListingAiAutofillService> logger;
        private readonly AiImagePreparer imagePreparer;

        public ListingAiAutofillService(
            ICategoryRepository categoryRepository,
            IStateOfItemRepository stateOfItemRepository,
            IImageRepository imageRepository,
            IYandexAiClient yandexAiClient,
            ILogger<ListingAiAutofillService> logger)
        {
            this.categoryRepository = categoryRepository;
            this.stateOfItemRepository = stateOfItemRepository;
            this.yandexAiClient = yandexAiClient;
            this.logger = logger;
            this.imagePreparer = new AiImagePreparer(imageRepository);
        }

        public async Task<AiAutofillListingResponse> AutofillAsync(
            ListingAiAutofillInput input,
            CancellationToken cancellationToken = default)
        {
            ValidateInput(input);

            var warnings = new List<string>();
            var images = await imagePreparer.LoadAsync(input, cancellationToken);
            var categories = await categoryRepository.GetAllAsync();
            var states = await stateOfItemRepository.GetAllAsync();
            var safeDescriptionHint = AiTextSanitizer.BuildSafeDescriptionHint(input.DescriptionHint);

            var categoryCandidates = AiEntityMatcher.BuildCategoryCandidates(categories);
            var firstPass = await RunFirstPassAsync(
                images,
                categoryCandidates,
                states,
                safeDescriptionHint,
                cancellationToken);

            var selectedCategory = AiEntityMatcher.MatchCategory(
                firstPass.Category,
                categoryCandidates,
                warnings);
            var selectedState = AiEntityMatcher.MatchByName(
                firstPass.State,
                states,
                state => state.Name,
                "состояние товара",
                warnings);

            var selectedCategoryDetails =
                await categoryRepository.GetByIdAsync(selectedCategory.Id)
                ?? throw new ListingAiAutofillException(
                    StatusCodes.Status502BadGateway,
                    "Не удалось получить выбранную AI категорию.");

            var propertySelections = new List<ListingPropertyValueSelectionDto>();
            var unmatchedFacts = new List<string>();

            if (selectedCategoryDetails.ListingProperties?.Count > 0)
            {
                var secondPass = await RunSecondPassAsync(
                    images,
                    selectedCategory,
                    selectedCategoryDetails.ListingProperties,
                    firstPass,
                    safeDescriptionHint,
                    cancellationToken);

                propertySelections = AiEntityMatcher.MatchPropertySelections(
                    secondPass.SelectedPropertyValues,
                    selectedCategoryDetails.ListingProperties,
                    warnings,
                    unmatchedFacts);

                unmatchedFacts.AddRange(secondPass.UnmatchedFacts ?? []);
            }

            var title = AiTextSanitizer.NormalizeTitle(
                firstPass.Title,
                selectedCategory.Category.Name,
                warnings);
            var description = AiTextSanitizer.BuildDescription(
                firstPass.Description,
                safeDescriptionHint,
                unmatchedFacts,
                warnings);

            return new AiAutofillListingResponse
            {
                Title = title,
                Description = description,
                StateOfItemId = selectedState.Id,
                CategoryId = selectedCategory.Id,
                PropertyValueSelection = propertySelections,
                Warnings = AiTextNormalization.DeduplicateStrings(warnings),
            };
        }

        private static void ValidateInput(ListingAiAutofillInput input)
        {
            var hasExistingImages = input.ExistingImageIds.Any();
            var hasNewImages = input.NewImages.Any();

            if (!hasExistingImages && !hasNewImages)
            {
                throw new ListingAiAutofillException(
                    StatusCodes.Status400BadRequest,
                    "Добавьте хотя бы одну фотографию для AI-анализа.");
            }

            if (hasExistingImages && !input.ListingId.HasValue)
            {
                throw new ListingAiAutofillException(
                    StatusCodes.Status400BadRequest,
                    "Для анализа уже сохранённых фотографий требуется listingId.");
            }
        }

        private async Task<FirstPassAiResponse> RunFirstPassAsync(
            IReadOnlyList<AiImagePayload> images,
            IReadOnlyList<CategoryCandidate> categoryCandidates,
            IReadOnlyList<Domain.Entities.StateOfItem> states,
            string? descriptionHint,
            CancellationToken cancellationToken)
        {
            var prompt = AiPromptBuilder.BuildFirstPassPrompt(
                categoryCandidates,
                states,
                descriptionHint);

            var rawResponse = await yandexAiClient.GenerateTextAsync(
                AiPromptBuilder.FirstPassInstructions,
                prompt,
                images,
                cancellationToken);

            try
            {
                return AiResponseParser.ParseModelJson<FirstPassAiResponse>(rawResponse);
            }
            catch (Exception exception)
            {
                logger.LogWarning(
                    exception,
                    "Не удалось распарсить первый ответ AI. Response={Response}",
                    rawResponse);
                throw new ListingAiAutofillException(
                    StatusCodes.Status502BadGateway,
                    "AI вернул некорректный ответ при определении категории и основных полей.");
            }
        }

        private async Task<SecondPassAiResponse> RunSecondPassAsync(
            IReadOnlyList<AiImagePayload> images,
            CategoryCandidate selectedCategory,
            IReadOnlyList<Domain.Entities.ListingProperty> listingProperties,
            FirstPassAiResponse firstPass,
            string? descriptionHint,
            CancellationToken cancellationToken)
        {
            var safeFirstPass = AiTextSanitizer.SanitizeFirstPassForFollowUp(firstPass);
            var prompt = AiPromptBuilder.BuildSecondPassPrompt(
                selectedCategory,
                listingProperties,
                safeFirstPass,
                descriptionHint);

            var rawResponse = await yandexAiClient.GenerateTextAsync(
                AiPromptBuilder.SecondPassInstructions,
                prompt,
                images,
                cancellationToken);

            try
            {
                return AiResponseParser.ParseModelJson<SecondPassAiResponse>(rawResponse);
            }
            catch (Exception exception)
            {
                logger.LogWarning(
                    exception,
                    "Не удалось распарсить второй ответ AI. Response={Response}",
                    rawResponse);
                throw new ListingAiAutofillException(
                    StatusCodes.Status502BadGateway,
                    "AI вернул некорректный ответ при подборе значений свойств.");
            }
        }
    }
}
