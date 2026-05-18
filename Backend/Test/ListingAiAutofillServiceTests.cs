using Application.Filters;
using Application.Interfaces;
using Application.Interfaces.Repositories;
using Application.Pagination;
using Domain.Entities;
using Infrastructure.FileStorage;
using Infrastructure.FileStorage.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using DomainImage = Domain.Entities.Image;
using ImageSharpImage = SixLabors.ImageSharp.Image;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using WebApi.Services;

namespace Test
{
    public class ListingAiAutofillServiceTests
    {
        [Fact]
        public async Task AutofillAsync_ThrowsBadRequest_WhenNoPhotosProvided()
        {
            var service = CreateService();

            var exception = await Assert.ThrowsAsync<ListingAiAutofillException>(
                () => service.AutofillAsync(new ListingAiAutofillInput()));

            Assert.Equal(StatusCodes.Status400BadRequest, exception.StatusCode);
        }

        [Fact]
        public async Task AutofillAsync_ThrowsForbidden_WhenExistingImageDoesNotBelongToListing()
        {
            var listingId = Guid.NewGuid();
            var service = CreateService(
                imageRepository: new FakeImageRepository
                {
                    StoredImages =
                    {
                        [Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")] =
                            new StoredImageFile(
                                new DomainImage
                                {
                                    Id = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
                                    ListingId = Guid.NewGuid(),
                                    FileName = "photo",
                                    FileExtension = ".jpg",
                                    FileSizeInBytes = 1024,
                                    ImageUrl = "https://localhost/photo.jpg",
                                    Listing = new Listing(),
                                },
                                "photo.jpg",
                                CreateTestImageBytes()),
                    },
                });

            var exception = await Assert.ThrowsAsync<ListingAiAutofillException>(
                () => service.AutofillAsync(
                    new ListingAiAutofillInput
                    {
                        ListingId = listingId,
                        ExistingImageIds =
                        [
                            Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
                        ],
                    }));

            Assert.Equal(StatusCodes.Status403Forbidden, exception.StatusCode);
        }

        [Fact]
        public async Task AutofillAsync_MapsKnownValues_AndAppendsUnknownFactsToDescription()
        {
            var categoryId = Guid.Parse("11111111-1111-1111-1111-111111111111");
            var brandPropertyId = Guid.Parse("22222222-2222-2222-2222-222222222222");
            var colorPropertyId = Guid.Parse("33333333-3333-3333-3333-333333333333");
            var adidasValueId = Guid.Parse("44444444-4444-4444-4444-444444444444");
            var whiteValueId = Guid.Parse("55555555-5555-5555-5555-555555555555");
            var stateId = Guid.Parse("66666666-6666-6666-6666-666666666666");

            var rootCategory = new Category
            {
                Id = Guid.Parse("77777777-7777-7777-7777-777777777777"),
                Name = "Обувь",
                ParentCategoryId = null,
                ListingProperties = new List<ListingProperty>(),
                Listings = new List<Listing>(),
                ChildrenCategories = new List<Category>(),
            };

            var sneakersCategory = new Category
            {
                Id = categoryId,
                Name = "Кроссовки",
                ParentCategoryId = rootCategory.Id,
                ListingProperties = new List<ListingProperty>
                {
                    new()
                    {
                        Id = brandPropertyId,
                        Name = "Бренд",
                        ListingPropertyValues = new List<ListingPropertyValue>
                        {
                            new()
                            {
                                Id = adidasValueId,
                                Name = "Adidas",
                                ListingPropertyId = brandPropertyId,
                                ListingProperty = null!,
                                Listings = new List<Listing>(),
                            },
                        },
                        Categories = new List<Category>(),
                    },
                    new()
                    {
                        Id = colorPropertyId,
                        Name = "Цвет",
                        ListingPropertyValues = new List<ListingPropertyValue>
                        {
                            new()
                            {
                                Id = whiteValueId,
                                Name = "Белый",
                                ListingPropertyId = colorPropertyId,
                                ListingProperty = null!,
                                Listings = new List<Listing>(),
                            },
                        },
                        Categories = new List<Category>(),
                    },
                },
                Listings = new List<Listing>(),
                ChildrenCategories = new List<Category>(),
            };

            var aiClient = new FakeYandexAiClient();
            aiClient.EnqueueResponse(
                """
                {
                  "title": "Белые кроссовки Adidas",
                  "description": "Белые кроссовки в хорошем состоянии.",
                  "category": "Обувь / Кроссовки",
                  "state": "Хорошее",
                  "observedFacts": ["бренд Adidas", "цвет белый", "материал замша"]
                }
                """);
            aiClient.EnqueueResponse(
                """
                {
                  "selectedPropertyValues": [
                    { "property": "Бренд", "value": "Adidas" },
                    { "property": "Цвет", "value": "Белый" },
                    { "property": "Материал", "value": "Замша" }
                  ],
                  "unmatchedFacts": ["Материал: замша"]
                }
                """);

            var service = CreateService(
                categoryRepository: new FakeCategoryRepository(
                    [rootCategory, sneakersCategory],
                    new Dictionary<Guid, Category>
                    {
                        [categoryId] = sneakersCategory,
                    }),
                stateRepository: new FakeStateRepository(
                    [
                        new StateOfItem
                        {
                            Id = stateId,
                            Name = "Хорошее",
                        },
                    ]),
                aiClient: aiClient);

            var result = await service.AutofillAsync(
                new ListingAiAutofillInput
                {
                    NewImages = [CreateFormFile("photo.jpg", CreateTestImageBytes())],
                });

            Assert.Equal("Белые кроссовки Adidas", result.Title);
            Assert.Equal(categoryId, result.CategoryId);
            Assert.Equal(stateId, result.StateOfItemId);
            Assert.Collection(
                result.PropertyValueSelection,
                selection =>
                {
                    Assert.Equal(brandPropertyId, selection.ListingPropertyId);
                    Assert.Equal(adidasValueId, selection.SelectedListingPropertyValueId);
                },
                selection =>
                {
                    Assert.Equal(colorPropertyId, selection.ListingPropertyId);
                    Assert.Equal(whiteValueId, selection.SelectedListingPropertyValueId);
                });
            Assert.Contains("Материал: Замша", result.Description);
            Assert.NotEmpty(result.Warnings);
        }

        [Fact]
        public async Task AutofillAsync_ThrowsBadGateway_WhenModelReturnsInvalidJson()
        {
            var aiClient = new FakeYandexAiClient();
            aiClient.EnqueueResponse("not-json");

            var service = CreateService(aiClient: aiClient);

            var exception = await Assert.ThrowsAsync<ListingAiAutofillException>(
                () => service.AutofillAsync(
                    new ListingAiAutofillInput
                    {
                        NewImages = [CreateFormFile("photo.jpg", CreateTestImageBytes())],
                    }));

            Assert.Equal(StatusCodes.Status502BadGateway, exception.StatusCode);
        }

        [Fact]
        public async Task AutofillAsync_ThrowsBadRequest_WhenImageCannotBeDecoded()
        {
            var service = CreateService();

            var exception = await Assert.ThrowsAsync<ListingAiAutofillException>(
                () => service.AutofillAsync(
                    new ListingAiAutofillInput
                    {
                        NewImages = [CreateFormFile("broken.webp", [1, 2, 3])],
                    }));

            Assert.Equal(StatusCodes.Status400BadRequest, exception.StatusCode);
            Assert.Contains("изображ", exception.Message, StringComparison.OrdinalIgnoreCase);
        }

        private static ListingAiAutofillService CreateService(
            ICategoryRepository? categoryRepository = null,
            IStateOfItemRepository? stateRepository = null,
            IImageRepository? imageRepository = null,
            IYandexAiClient? aiClient = null)
        {
            var defaultCategory = new Category
            {
                Id = Guid.Parse("99999999-9999-9999-9999-999999999999"),
                Name = "Одежда",
                ParentCategoryId = null,
                ListingProperties = new List<ListingProperty>(),
                Listings = new List<Listing>(),
                ChildrenCategories = new List<Category>(),
            };

            return new ListingAiAutofillService(
                categoryRepository ?? new FakeCategoryRepository(
                    [defaultCategory],
                    new Dictionary<Guid, Category>
                    {
                        [defaultCategory.Id] = defaultCategory,
                    }),
                stateRepository ?? new FakeStateRepository(
                    [
                        new StateOfItem
                        {
                            Id = Guid.Parse("88888888-8888-8888-8888-888888888888"),
                            Name = "Новый",
                        },
                    ]),
                imageRepository ?? new FakeImageRepository(),
                aiClient ?? new FakeYandexAiClient(),
                NullLogger<ListingAiAutofillService>.Instance);
        }

        private static IFormFile CreateFormFile(string fileName, byte[] content)
        {
            var stream = new MemoryStream(content);
            return new FormFile(stream, 0, content.Length, "file", fileName)
            {
                Headers = new HeaderDictionary(),
            };
        }

        private static byte[] CreateTestImageBytes()
        {
            using var image = new SixLabors.ImageSharp.Image<Rgba32>(2, 2, new Rgba32(255, 255, 255, 255));
            using var stream = new MemoryStream();
            image.SaveAsPng(stream);
            return stream.ToArray();
        }

        private sealed class FakeYandexAiClient : IYandexAiClient
        {
            private readonly Queue<string> responses = new();

            public void EnqueueResponse(string response)
            {
                responses.Enqueue(response);
            }

            public Task<string> GenerateTextAsync(
                string instructions,
                string prompt,
                IReadOnlyList<AiImagePayload> images,
                CancellationToken cancellationToken = default)
            {
                if (responses.Count == 0)
                {
                    return Task.FromResult(
                        """
                        {
                          "title": "Товар",
                          "description": "Описание",
                          "category": "Одежда",
                          "state": "Новый",
                          "observedFacts": []
                        }
                        """);
                }

                return Task.FromResult(responses.Dequeue());
            }
        }

        private sealed class FakeCategoryRepository : ICategoryRepository
        {
            private readonly List<Category> categories;
            private readonly Dictionary<Guid, Category> categoriesById;

            public FakeCategoryRepository(
                List<Category> categories,
                Dictionary<Guid, Category> categoriesById)
            {
                this.categories = categories;
                this.categoriesById = categoriesById;
            }

            public Task<Category?> AddListingPropertiesAsync(
                Guid categoryId,
                List<Guid> ListingPropertyIds)
            {
                throw new NotImplementedException();
            }

            public Task<Category> CreateAsync(Category category)
            {
                throw new NotImplementedException();
            }

            public Task<Category?> DeleteAsync(Guid id)
            {
                throw new NotImplementedException();
            }

            public Task<List<Listing>> GetDescendantListingsAsync(Guid categoryId)
            {
                throw new NotImplementedException();
            }

            public Task<List<Category>> GetAllAsync()
            {
                return Task.FromResult(categories);
            }

            public Task<Category?> GetByIdAsync(Guid id)
            {
                categoriesById.TryGetValue(id, out var category);
                return Task.FromResult(category);
            }

            public Task<Category?> GetByNameAsync(string name)
            {
                return Task.FromResult(categories.FirstOrDefault(c => c.Name == name));
            }

            public Task<Page<Listing>> GetListingsByCategoryNameAsync(
                string name,
                ListingFilter filter,
                int pageNumber = 1,
                int pageSize = 20)
            {
                throw new NotImplementedException();
            }

            public Task<Category?> RemoveListingPropertyAsync(Guid categoryId, Guid groupId)
            {
                throw new NotImplementedException();
            }

            public Task<Category?> UpdateAsync(Guid id, Category category)
            {
                throw new NotImplementedException();
            }
        }

        private sealed class FakeStateRepository : IStateOfItemRepository
        {
            private readonly List<StateOfItem> states;

            public FakeStateRepository(List<StateOfItem> states)
            {
                this.states = states;
            }

            public Task<List<StateOfItem>> GetAllAsync()
            {
                return Task.FromResult(states);
            }
        }

        private sealed class FakeImageRepository : IImageRepository
        {
            public Dictionary<Guid, StoredImageFile> StoredImages { get; } = new();

            public Task<int> CountByListingIdAsync(Guid listingId)
            {
                return Task.FromResult(StoredImages.Count);
            }

            public Task<DomainImage?> DeleteAsync(Guid id)
            {
                throw new NotImplementedException();
            }

            public void DeleteImageFromFileSystem(DomainImage image)
            {
            }

            public Task<List<DomainImage>> GetAllAsync()
            {
                throw new NotImplementedException();
            }

            public Task<DomainImage?> GetByIdAsync(Guid id)
            {
                throw new NotImplementedException();
            }

            public Task<StoredImageFile?> GetStoredFileAsync(
                Guid id,
                CancellationToken cancellationToken = default)
            {
                StoredImages.TryGetValue(id, out var storedImage);
                return Task.FromResult(storedImage);
            }

            public Task<DomainImage?> UploadAsync(Guid listingId, IFormFile file)
            {
                throw new NotImplementedException();
            }
        }
    }
}
