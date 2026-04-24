namespace WebApi.Services
{
    public interface IBackgroundNotificationQueue
    {
        ValueTask QueueAsync(
            Func<INotificationEmailService, CancellationToken, Task> workItem);
    }
}
