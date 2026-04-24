namespace Infrastructure.ImageProcessing
{
    public sealed class RembgOptions
    {
        public const string SectionName = "Rembg";

        public string? Endpoint { get; set; }

        public int TimeoutSeconds { get; set; } = 120;
    }
}
