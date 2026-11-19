using System.Net.Http.Json;
using KyivAlert.Api;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace KyivAlert.Tests;

public sealed class RegionalAlertsTests
{
    [Fact]
    public void NationalResponseCoversAllRegionsInProviderOrder()
    {
        var codes = Enumerable.Repeat('N', 27).ToArray();
        codes[9] = 'R';
        codes[10] = 'P';
        codes[21] = 'Y';
        var alerts = RegionalAlerts.ParseNational(new string(codes));

        Assert.Equal(27, alerts.Select(alert => alert.RegionId).Distinct().Count());
        Assert.Equal("active", alerts.Single(alert => alert.RegionId == "UA-30").Level);
        Assert.Equal("partial", alerts.Single(alert => alert.RegionId == "UA-32").Level);
        Assert.Equal("warning", alerts.Single(alert => alert.RegionId == "UA-63").Level);
        Assert.Equal("none", alerts.Single(alert => alert.RegionId == "UA-46").Level);
    }

    [Theory]
    [InlineData("")]
    [InlineData("R")]
    [InlineData("AXNNNNNNNNNNNNNNNNNNNNNNNNN")]
    public void RejectsIncompleteOrUnrecognizedPayload(string codes) =>
        Assert.Throws<InvalidDataException>(() => RegionalAlerts.ParseNational(codes));

    [Fact]
    public async Task DefaultFeedContainsNoSourceMetadataOrInventedAlerts()
    {
        await using var factory = new WebApplicationFactory<Program>();
        using var client = factory.CreateClient();
        var feed = await client.GetFromJsonAsync<RegionalAlertsSnapshot>("/api/civil-alerts");

        Assert.NotNull(feed);
        Assert.Equal("disabled", feed.Status);
        Assert.Empty(feed.Alerts);
        Assert.Null(feed.CheckedAt);
        Assert.DoesNotContain("sourceUrl", await client.GetStringAsync("/api/civil-alerts"));
    }
}
