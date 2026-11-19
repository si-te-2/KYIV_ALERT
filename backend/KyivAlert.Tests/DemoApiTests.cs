using System.Net.Http.Json;
using KyivAlert.Core;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace KyivAlert.Tests;

public sealed class DemoApiTests
{
    [Fact]
    public async Task StatusClearlyReportsStoppedMonitoringAndSyntheticMessages()
    {
        await using var factory = new WebApplicationFactory<Program>();
        using var client = factory.CreateClient();
        var snapshot = await client.GetFromJsonAsync<SystemSnapshot>("/api/status");

        Assert.NotNull(snapshot);
        Assert.True(snapshot.DemoMode);
        Assert.Equal("STOPPED", snapshot.MonitoringStatus);
        Assert.Equal("NOT_CONFIGURED", snapshot.TelegramStatus);
        Assert.NotEmpty(snapshot.Messages);
        Assert.All(snapshot.Messages, message => Assert.True(message.IsTest));
        Assert.Equal("no-store", (await client.GetAsync("/api/status")).Headers.CacheControl?.ToString());
    }

    [Fact]
    public async Task PublicStatusHidesSourceNamesAndLinks()
    {
        await using var factory = new WebApplicationFactory<Program>();
        using var client = factory.CreateClient();
        var snapshot = await client.GetFromJsonAsync<SystemSnapshot>("/api/status");

        Assert.NotNull(snapshot);
        Assert.Empty(snapshot.Sources);
        Assert.All(snapshot.Messages, message =>
        {
            Assert.Empty(message.SourceName);
            Assert.Null(message.OriginalUrl);
        });
    }

    [Fact]
    public void ApplicationRejectsLiveMode()
    {
        using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
            builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(
                new Dictionary<string, string?> { ["DemoMode"] = "false" })));

        var exception = Assert.Throws<InvalidOperationException>(() => factory.CreateClient());
        Assert.Contains("DemoMode=true", exception.Message);
    }

    [Fact]
    public async Task HealthEndpointRespondsSuccessfully()
    {
        await using var factory = new WebApplicationFactory<Program>();
        using var client = factory.CreateClient();
        var response = await client.GetAsync("/api/health");
        response.EnsureSuccessStatusCode();
    }
}
