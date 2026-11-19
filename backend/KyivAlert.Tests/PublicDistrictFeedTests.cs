using System.Net;
using System.Net.Http.Json;
using KyivAlert.Api;
using Xunit;

namespace KyivAlert.Tests;

public sealed class PublicDistrictFeedTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 20, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task DistrictAlertHighlightsOnlyThatDistrictAndMakesParentPartial()
    {
        using var client = Client(Now, new { slug = "borispilskii-raion", level = "yellow", oblast_slug = "kyivska" });
        var snapshot = await PublicDistrictFeed.ReadAsync(client, Now, CancellationToken.None);

        Assert.Equal("ready", snapshot.Status);
        Assert.Equal("partial", snapshot.Alerts.Single(alert => alert.RegionId == "UA-32").Level);
        Assert.StartsWith("UA32", snapshot.Alerts.Single(alert => alert.Level == "warning").RegionId);
        Assert.Equal("clear", snapshot.Alerts.Single(alert => alert.RegionId == "UA-51").Level);
        Assert.DoesNotContain(snapshot.Alerts, alert => alert.RegionId == "UA-43");
    }

    [Fact]
    public async Task WholeOblastAlertInheritsIntoItsDistricts()
    {
        using var client = Client(Now, new { slug = "odeska", level = "red", oblast_slug = (string?)null });
        var snapshot = await PublicDistrictFeed.ReadAsync(client, Now, CancellationToken.None);

        Assert.Equal(7, snapshot.Alerts.Count(alert => alert.RegionId.StartsWith("UA51") && alert.Inherited && alert.Level == "active"));
    }

    [Fact]
    public async Task KhersonCommunityAlertStaysPartialInItsDistrictAndOblast()
    {
        using var client = Client(Now, new { slug = "m-xerson-ta-xersonska-teritorialna-gromada", level = "red", oblast_slug = (string?)null });
        var snapshot = await PublicDistrictFeed.ReadAsync(client, Now, CancellationToken.None);

        Assert.Equal("partial", snapshot.Alerts.Single(alert => alert.RegionId == "UA6510").Level);
        Assert.Equal("partial", snapshot.Alerts.Single(alert => alert.RegionId == "UA-65").Level);
    }

    [Fact]
    public async Task StaleFeedIsRejected()
    {
        using var client = Client(Now.AddMinutes(-4));
        await Assert.ThrowsAsync<InvalidDataException>(() => PublicDistrictFeed.ReadAsync(client, Now, CancellationToken.None));
    }

    private static HttpClient Client(DateTimeOffset timestamp, params object[] alerts) =>
        new(new ResponseHandler(new { updated_at = timestamp, active = alerts.Length, alerts }));

    private sealed class ResponseHandler(object body) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = JsonContent.Create(body) });
    }
}
