using System.Globalization;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using TL;
using WTelegram;

namespace KyivAlert.Telegram;

public sealed class CivilAlertsMonitor(
    IConfiguration configuration,
    TimeProvider clock,
    ILogger<CivilAlertsMonitor> logger) : BackgroundService
{
    private static readonly TimeSpan RequestTimeout = TimeSpan.FromSeconds(25);
    private static readonly TimeSpan PollInterval = TimeSpan.FromSeconds(45);
    private static readonly TimeSpan FreshnessLimit = TimeSpan.FromMinutes(2);
    private static readonly TimeSpan HistoryLimit = TimeSpan.FromHours(48);
    private const int MonitoringHistoryLimit = 50;
    private CivilAlertsSnapshot snapshot = new(configuration.GetValue("CivilAlerts:Enabled", false)
        ? "connecting" : "disabled", null, []);
    private IReadOnlyList<MonitoringSignal> monitoringSignals = [];

    public CivilAlertsSnapshot GetSnapshot()
    {
        var current = Volatile.Read(ref snapshot);
        if (current.Status == "ready" && current.CheckedAt is { } checkedAt &&
            clock.GetUtcNow() - checkedAt > FreshnessLimit)
        {
            return new("unavailable", checkedAt, []);
        }
        return current.Status == "unavailable" ? current with { Alerts = [] } : current;
    }

    public DroneWarningsSnapshot GetDroneWarnings() =>
        DroneWarningsSnapshot.From(
            Volatile.Read(ref snapshot), Volatile.Read(ref monitoringSignals), clock.GetUtcNow());

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (GetSnapshot().Status == "disabled") return;

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ReadChannelAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception error)
            {
                logger.LogWarning("Civil alert feed unavailable ({ErrorType}).", error.GetType().Name);
                Volatile.Write(ref snapshot, Volatile.Read(ref snapshot) with { Status = "unavailable" });
                await Task.Delay(TimeSpan.FromMinutes(2), clock, stoppingToken);
            }
        }
    }

    private async Task ReadChannelAsync(CancellationToken stoppingToken)
    {
        var apiHash = configuration["Telegram:ApiHash"];
        if (!int.TryParse(configuration["Telegram:ApiId"], out var apiId) || apiId <= 0 ||
            apiHash is null || apiHash.Length != 32 || !apiHash.All(Uri.IsHexDigit))
            throw new InvalidOperationException("Configure Telegram application credentials.");

        var sessionPath = TelegramSessionStorage.Prepare(configuration);
        var directory = Path.GetDirectoryName(sessionPath)!;
        if (!File.Exists(sessionPath))
            throw new InvalidOperationException("Sign in with the local Telegram command first.");

        using var sessionLock = new FileStream(
            Path.Combine(directory, "login.lock"), FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);
        Helpers.Log = (_, _) => { };

        // The background worker can only resume a session created through the local login command.
        string? GetConfiguration(string key) => key switch
        {
            "api_id" => apiId.ToString(CultureInfo.InvariantCulture),
            "api_hash" => apiHash,
            "session_pathname" => sessionPath,
            "user_id" => "-1",
            "phone_number" or "verification_code" or "password" or "email" or "email_verification_code"
                => throw new InvalidOperationException("Local Telegram session needs a new sign-in."),
            _ => null
        };

        using var client = new Client(GetConfiguration!);
        await client.LoginUserIfNeeded(reloginOnFailedResume: false).WaitAsync(RequestTimeout, stoppingToken);
        var channels = new List<(string Username, Channel Peer)>();
        foreach (var username in new[] { CivilAlertParser.CityChannel, CivilAlertParser.OblastChannel })
        {
            var resolved = await client.Contacts_ResolveUsername(username).WaitAsync(RequestTimeout, stoppingToken);
            var channel = resolved.Channel ?? throw new InvalidOperationException("Official alert channel is unavailable.");
            channels.Add((username, channel));
        }
        using var sessionStopping = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
        var monitoring = PollMonitoringAsync(client, sessionStopping.Token);
        try
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                var now = clock.GetUtcNow();
                var cutoff = now - HistoryLimit;
                var alerts = new List<CivilAlert>();
                foreach (var (username, channel) in channels)
                {
                    var latest = await client.Messages_GetHistory(channel, limit: 100).WaitAsync(RequestTimeout, stoppingToken);
                    var posts = latest.Messages.OfType<Message>()
                        .Where(message => message.date >= cutoff && message.date <= now && message.fwd_from is null)
                        .Select(message => (message.id, new DateTimeOffset(message.date), message.message));
                    if (CivilAlertParser.SelectLatest(username, posts) is { } alert) alerts.Add(alert);
                }

                Volatile.Write(ref snapshot, new("ready", clock.GetUtcNow(), alerts.AsReadOnly()));
                await Task.Delay(PollInterval, clock, stoppingToken);
            }
        }
        finally
        {
            await sessionStopping.CancelAsync();
            try { await monitoring; }
            catch (OperationCanceledException) when (sessionStopping.IsCancellationRequested) { }
            Volatile.Write(ref monitoringSignals, Array.Empty<MonitoringSignal>());
        }
    }

    private async Task PollMonitoringAsync(Client client, CancellationToken stoppingToken)
    {
        var channels = await ResolveMonitoringChannelsAsync(client, stoppingToken);
        if (channels.Count == 0) return;
        while (!stoppingToken.IsCancellationRequested)
        {
            Volatile.Write(ref monitoringSignals, await ReadMonitoringAsync(client, channels, stoppingToken));
            await Task.Delay(PollInterval, clock, stoppingToken);
        }
    }

    // Optional unofficial sources: CivilAlerts:MonitoringChannels as an array or a comma-separated string.
    private IReadOnlyList<string> MonitoringChannelNames()
    {
        var section = configuration.GetSection("CivilAlerts:MonitoringChannels");
        return section.GetChildren().Select(child => child.Value).Append(section.Value)
            .SelectMany(value => (value ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            .Select(name => name.TrimStart('@'))
            .Where(MonitoringPostParser.IsChannelName)
            .Where(name => !name.Equals(CivilAlertParser.CityChannel, StringComparison.OrdinalIgnoreCase) &&
                !name.Equals(CivilAlertParser.OblastChannel, StringComparison.OrdinalIgnoreCase))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
    }

    private async Task<List<(string Username, Channel Peer)>> ResolveMonitoringChannelsAsync(
        Client client, CancellationToken stoppingToken)
    {
        var resolvedChannels = new List<(string Username, Channel Peer)>();
        foreach (var username in MonitoringChannelNames())
        {
            try
            {
                var resolved = await client.Contacts_ResolveUsername(username).WaitAsync(RequestTimeout, stoppingToken);
                if (resolved.Channel is { } channel)
                {
                    resolvedChannels.Add((username, channel));
                    logger.LogInformation("Monitoring source {Channel} connected.", username);
                }
                else logger.LogWarning("Monitoring source {Channel} is not a public channel.", username);
            }
            catch (Exception error) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogWarning("Monitoring source {Channel} is unavailable ({ErrorType}).",
                    username, error.GetType().Name);
            }
        }
        return resolvedChannels;
    }

    // A failing monitoring channel is skipped. It never affects the official feed.
    private async Task<IReadOnlyList<MonitoringSignal>> ReadMonitoringAsync(
        Client client, List<(string Username, Channel Peer)> channels, CancellationToken stoppingToken)
    {
        var now = clock.GetUtcNow();
        var cutoff = now - MonitoringPostParser.SignalLifetime;
        var signals = new List<MonitoringSignal>();
        foreach (var (username, channel) in channels)
        {
            try
            {
                var latest = await client.Messages_GetHistory(channel, limit: MonitoringHistoryLimit)
                    .WaitAsync(RequestTimeout, stoppingToken);
                foreach (var message in latest.Messages.OfType<Message>())
                {
                    if (message.fwd_from is not null || message.date < cutoff || message.date > now) continue;
                    signals.AddRange(MonitoringPostParser.Parse(
                        username, message.id, new DateTimeOffset(message.date), message.message));
                }
                logger.LogInformation("Monitoring source {Channel} read successfully.", username);
            }
            catch (Exception error) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogWarning("Monitoring source {Channel} could not be read ({ErrorType}).",
                    username, error.GetType().Name);
            }
        }
        return signals;
    }
}
