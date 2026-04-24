using System.Threading.Channels;

namespace WebApi.Services
{
    public sealed class BackgroundNotificationQueue : BackgroundService, IBackgroundNotificationQueue
    {
        private static readonly TimeSpan SmtpAuthErrorLogThrottle = TimeSpan.FromMinutes(2);
        private readonly Channel<Func<INotificationEmailService, CancellationToken, Task>> channel;
        private readonly IServiceScopeFactory serviceScopeFactory;
        private readonly ILogger<BackgroundNotificationQueue> logger;
        private DateTimeOffset lastSmtpAuthErrorLogAt = DateTimeOffset.MinValue;
        private int suppressedSmtpAuthErrorCount;

        public BackgroundNotificationQueue(
            IServiceScopeFactory serviceScopeFactory,
            ILogger<BackgroundNotificationQueue> logger)
        {
            this.serviceScopeFactory = serviceScopeFactory;
            this.logger = logger;
            channel = Channel.CreateUnbounded<Func<INotificationEmailService, CancellationToken, Task>>(
                new UnboundedChannelOptions
                {
                    SingleReader = true,
                    SingleWriter = false
                });
        }

        public ValueTask QueueAsync(
            Func<INotificationEmailService, CancellationToken, Task> workItem)
        {
            if (workItem == null)
            {
                throw new ArgumentNullException(nameof(workItem));
            }

            return channel.Writer.WriteAsync(workItem);
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            await foreach (var workItem in channel.Reader.ReadAllAsync(stoppingToken))
            {
                try
                {
                    using var scope = serviceScopeFactory.CreateScope();
                    var notificationEmailService =
                        scope.ServiceProvider.GetRequiredService<INotificationEmailService>();
                    await workItem(notificationEmailService, stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (InvalidOperationException exception) when (IsSmtpAuthenticationFailure(exception))
                {
                    LogSmtpAuthenticationFailure(exception);
                }
                catch (Exception exception)
                {
                    logger.LogWarning(
                        exception,
                        "Failed to process background notification email job.");
                }
            }
        }

        private static bool IsSmtpAuthenticationFailure(InvalidOperationException exception)
        {
            return exception.Message.StartsWith(
                "SMTP authentication failed",
                StringComparison.OrdinalIgnoreCase);
        }

        private void LogSmtpAuthenticationFailure(InvalidOperationException exception)
        {
            var utcNow = DateTimeOffset.UtcNow;
            var shouldLogNow = utcNow - lastSmtpAuthErrorLogAt >= SmtpAuthErrorLogThrottle;

            if (!shouldLogNow)
            {
                suppressedSmtpAuthErrorCount++;
                return;
            }

            if (suppressedSmtpAuthErrorCount > 0)
            {
                logger.LogWarning(
                    "Suppressed {Count} repeated SMTP authentication failures in background notification queue.",
                    suppressedSmtpAuthErrorCount);
                suppressedSmtpAuthErrorCount = 0;
            }

            lastSmtpAuthErrorLogAt = utcNow;
            logger.LogError(
                "{Message} Background notifications will retry automatically after SMTP credentials are fixed.",
                exception.Message);
        }
    }
}
