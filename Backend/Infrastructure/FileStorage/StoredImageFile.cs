using Domain.Entities;

namespace Infrastructure.FileStorage
{
    public sealed record StoredImageFile(Image Image, string FilePath, byte[] Content);
}
