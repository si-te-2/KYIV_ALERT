using System.Net;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace KyivAlert.Tests;

public sealed class PublicApiTests
{
    private static WebApplicationFactory<Program> CreateFactory() =>
        new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
            builder.ConfigureAppConfiguration((_, configuration) => configuration.AddInMemoryCollection(
                new Dictionary<string, string?>
                {
                    ["PublicApi:AllowedOrigin"] = "https://si-te-2.github.io",
                    ["PublicApi:ReadOnly"] = "true",
                })));

    [Theory]
    [InlineData("https://si-te-2.github.io", true)]
    [InlineData("https://another-site.example", false)]
    [InlineData("http://si-te-2.github.io", false)]
    public async Task OnlyConfiguredPagesOriginReceivesCorsHeaders(string origin, bool allowed)
    {
        await using var factory = CreateFactory();
        using var client = factory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/drone-warnings");
        request.Headers.Add("Origin", origin);
        using var response = await client.SendAsync(request);
        response.EnsureSuccessStatusCode();
        Assert.Equal(allowed, response.Headers.Contains("Access-Control-Allow-Origin"));
        if (allowed) Assert.Equal(origin, Assert.Single(response.Headers.GetValues("Access-Control-Allow-Origin")));
        Assert.False(response.Headers.Contains("Access-Control-Allow-Credentials"));
    }

    [Fact]
    public async Task PublicModeDoesNotServeSyntheticDemoMessages()
    {
        await using var factory = CreateFactory();
        using var client = factory.CreateClient();
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/status")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/health")).StatusCode);
        Assert.Equal(HttpStatusCode.MethodNotAllowed,
            (await client.PostAsync("/api/drone-warnings", null)).StatusCode);
    }
}
