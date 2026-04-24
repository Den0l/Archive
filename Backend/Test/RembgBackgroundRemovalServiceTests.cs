using System.Net;
using System.Net.Http;
using System.Text;
using Infrastructure.ImageProcessing;
using Infrastructure.ImageProcessing.Services;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace Test
{
    public class RembgBackgroundRemovalServiceTests
    {
        private const string JsonErrorMessage =
            "\u041e\u0448\u0438\u0431\u043a\u0430 rembg.";

        private const string EmptyResponseMessage =
            "\u0421\u0435\u0440\u0432\u0438\u0441 \u0443\u0434\u0430\u043b\u0435\u043d\u0438\u044f \u0444\u043e\u043d\u0430 \u0432\u0435\u0440\u043d\u0443\u043b \u043f\u0443\u0441\u0442\u043e\u0439 \u043e\u0442\u0432\u0435\u0442.";

        [Fact]
        public async Task RemoveBackgroundAsync_ReturnsPngBytes_WhenRembgSucceeds()
        {
            var expectedBytes = new byte[] { 137, 80, 78, 71 };
            using var handler = new FakeHttpMessageHandler((request, cancellationToken) =>
            {
                Assert.Equal(HttpMethod.Post, request.Method);
                Assert.Equal(
                    "http://localhost:7000/api/remove",
                    request.RequestUri?.ToString());
                Assert.NotNull(request.Content);
                Assert.Equal(
                    "multipart/form-data",
                    request.Content!.Headers.ContentType?.MediaType);

                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new ByteArrayContent(expectedBytes),
                });
            });
            using var httpClient = new HttpClient(handler);
            var service = CreateService(httpClient);

            var result = await service.RemoveBackgroundAsync([1, 2, 3], CancellationToken.None);

            Assert.Equal(expectedBytes, result);
        }

        [Fact]
        public async Task RemoveBackgroundAsync_ThrowsDetailedError_WhenRembgReturnsJsonError()
        {
            using var handler = new FakeHttpMessageHandler((request, cancellationToken) =>
                Task.FromResult(new HttpResponseMessage(HttpStatusCode.BadRequest)
                {
                    Content = new StringContent(
                        $"{{\"detail\":\"{JsonErrorMessage}\"}}",
                        Encoding.UTF8,
                        "application/json"),
                }));
            using var httpClient = new HttpClient(handler);
            var service = CreateService(httpClient);

            var exception = await Assert.ThrowsAsync<InvalidOperationException>(() =>
                service.RemoveBackgroundAsync([1, 2, 3], CancellationToken.None));

            Assert.Equal(JsonErrorMessage, exception.Message);
        }

        [Fact]
        public async Task RemoveBackgroundAsync_ThrowsTextError_WhenRembgReturnsPlainTextError()
        {
            using var handler = new FakeHttpMessageHandler((request, cancellationToken) =>
                Task.FromResult(new HttpResponseMessage(HttpStatusCode.BadGateway)
                {
                    Content = new StringContent("Upstream rembg error.", Encoding.UTF8, "text/plain"),
                }));
            using var httpClient = new HttpClient(handler);
            var service = CreateService(httpClient);

            var exception = await Assert.ThrowsAsync<InvalidOperationException>(() =>
                service.RemoveBackgroundAsync([1, 2, 3], CancellationToken.None));

            Assert.Equal("Upstream rembg error.", exception.Message);
        }

        [Fact]
        public async Task RemoveBackgroundAsync_Throws_WhenRembgReturnsEmptyBody()
        {
            using var handler = new FakeHttpMessageHandler((request, cancellationToken) =>
                Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new ByteArrayContent([]),
                }));
            using var httpClient = new HttpClient(handler);
            var service = CreateService(httpClient);

            var exception = await Assert.ThrowsAsync<InvalidOperationException>(() =>
                service.RemoveBackgroundAsync([1, 2, 3], CancellationToken.None));

            Assert.Equal(EmptyResponseMessage, exception.Message);
        }

        private static RembgBackgroundRemovalService CreateService(HttpClient httpClient)
        {
            return new RembgBackgroundRemovalService(
                httpClient,
                Options.Create(new RembgOptions
                {
                    Endpoint = "http://localhost:7000/api/remove",
                    TimeoutSeconds = 120,
                }),
                NullLogger<RembgBackgroundRemovalService>.Instance);
        }

        private sealed class FakeHttpMessageHandler : HttpMessageHandler
        {
            private readonly Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> handler;

            public FakeHttpMessageHandler(
                Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> handler)
            {
                this.handler = handler;
            }

            protected override Task<HttpResponseMessage> SendAsync(
                HttpRequestMessage request,
                CancellationToken cancellationToken)
            {
                return handler(request, cancellationToken);
            }
        }
    }
}
