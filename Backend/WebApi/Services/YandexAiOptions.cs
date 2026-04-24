namespace WebApi.Services
{
    public sealed class YandexAiOptions
    {
        public string Endpoint { get; set; } = "https://ai.api.cloud.yandex.net/v1/chat/completions";

        public string? ApiKey { get; set; }

        public string? FolderId { get; set; }

        public string? Model { get; set; }

        public string DefaultVisionModel { get; set; } = "gemma-3-27b-it";
    }
}
