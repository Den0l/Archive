namespace Infrastructure.ImageProcessing.Interfaces
{
    public interface IBackgroundRemovalService
    {
        Task<byte[]> RemoveBackgroundAsync(
            byte[] sourceImage,
            CancellationToken cancellationToken = default);
    }
}
