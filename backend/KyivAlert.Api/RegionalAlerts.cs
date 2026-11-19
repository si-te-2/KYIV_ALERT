using System.Net.Http.Headers;
using KyivAlert.Telegram;

namespace KyivAlert.Api;

public sealed record RegionalAlert(string RegionId, string Level, DateTimeOffset? PublishedAt);

public sealed record RegionalAlertsSnapshot(string Status, DateTimeOffset? CheckedAt, IReadOnlyList<RegionalAlert> Alerts);

public sealed class RegionalAlerts(
    IHttpClientFactory clients,
    IConfiguration configuration,
    CivilAlertsMonitor civilAlerts,
    TimeProvider clock,
    ILogger<RegionalAlerts> logger) : BackgroundService
{
    private static readonly TimeSpan PollInterval = TimeSpan.FromSeconds(45);
    private static readonly TimeSpan RetryInterval = TimeSpan.FromMinutes(2);

    // Provider order, not ISO code order. The endpoint sends one character per region.
    private static readonly string[] RegionIds =
    [
        "UA-43", "UA-07", "UA-05", "UA-12", "UA-14", "UA-18", "UA-21", "UA-23", "UA-26",
        "UA-30", "UA-32", "UA-35", "UA-09", "UA-46", "UA-48", "UA-51", "UA-53", "UA-56",
        "UA-40", "UA-59", "UA-61", "UA-63", "UA-65", "UA-68", "UA-71", "UA-77", "UA-74",
    ];

    private RegionalAlertsSnapshot? national;

    public RegionalAlertsSnapshot Read()
    {
        var latest = Volatile.Read(ref national);
        if (latest?.CheckedAt is { } checkedAt && clock.GetUtcNow() - checkedAt < RetryInterval)
            return latest;

        var local = civilAlerts.GetSnapshot();
        var alerts = local.Alerts.Select(alert => new RegionalAlert(
            alert.RegionId, alert.Active ? (alert.Partial ? "partial" : "active") : "ended", alert.PublishedAt
        )).ToArray();
        return new(local.Status == "ready" ? "limited" : local.Status, local.CheckedAt, alerts);
    }

    public static IReadOnlyList<RegionalAlert> ParseNational(string? codes)
    {
        if (codes is null || codes.Length != RegionIds.Length ||
            codes.Any(code => code is not ('R' or 'Y' or 'P' or 'N')))
            throw new InvalidDataException("Unexpected regional status response.");

        return RegionIds.Select((id, index) => new RegionalAlert(id, codes[index] switch
        {
            'R' => "active",
            'Y' => "warning",
            'P' => "partial",
            // The provider reports no alert information for N. It is not an explicit all-clear.
            _ => "none",
        }, null)).ToArray();
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var token = configuration["CivilAlerts:NationalApiToken"]?.Trim();
        if (string.IsNullOrEmpty(token)) return;

        using var client = clients.CreateClient("regional-alerts");
        while (!stoppingToken.IsCancellationRequested)
        {
            var delay = PollInterval;
            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Get,
                    "https://api.alerts.in.ua/v2/iot/active_air_raid_alerts_by_oblast.json");
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
                using var response = await client.SendAsync(request, stoppingToken);
                response.EnsureSuccessStatusCode();
                var codes = await response.Content.ReadFromJsonAsync<string>(cancellationToken: stoppingToken);
                Volatile.Write(ref national, new RegionalAlertsSnapshot("ready", clock.GetUtcNow(), ParseNational(codes)));
            }
            catch (Exception error) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogWarning("National regional alert feed unavailable ({ErrorType}).", error.GetType().Name);
                Volatile.Write(ref national, null);
                delay = RetryInterval;
            }
            await Task.Delay(delay, clock, stoppingToken);
        }
    }
}
