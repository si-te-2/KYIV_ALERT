using System.Text.Json;
using System.Text.Json.Serialization;

namespace KyivAlert.Api;

public static class PublicDistrictFeed
{
    private static readonly IReadOnlyDictionary<string, FeedArea> Areas = ReadAreas();

    public static async Task<RegionalAlertsSnapshot> ReadAsync(
        HttpClient client, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var payload = await client.GetFromJsonAsync<FeedResponse>(
            "https://tryvoha.online/api/v1/alerts", cancellationToken);
        return Parse(payload, now);
    }

    internal static RegionalAlertsSnapshot Parse(FeedResponse? payload, DateTimeOffset now)
    {
        if (payload?.Alerts is not { } alerts || payload.Active != alerts.Count ||
            payload.UpdatedAt == default || payload.UpdatedAt < now.AddMinutes(-3) ||
            payload.UpdatedAt > now.AddMinutes(1))
            throw new InvalidDataException("The regional response is incomplete or stale.");

        var reported = new Dictionary<string, RegionalAlert>();
        var unmappedParents = new HashSet<string>();
        foreach (var entry in alerts)
        {
            var level = entry.Level switch
            {
                "red" => "active",
                "yellow" => "warning",
                _ => throw new InvalidDataException("An unrecognized regional alert level was returned.")
            };
            var area = entry.Slug is null ? null : Areas.GetValueOrDefault(entry.Slug);
            if (area?.Id is not { } id)
            {
                var parent = area?.ParentId ??
                    (entry.OblastSlug is { } slug ? Areas.GetValueOrDefault(slug)?.Id : null);
                if (parent is null)
                    throw new InvalidDataException("An active alert doesn't match a mapped parent region.");
                unmappedParents.Add(parent);
                continue;
            }

            var alert = new RegionalAlert(id, area.Subarea ? "partial" : level, entry.StartedAt);
            if (!reported.TryGetValue(id, out var existing) || Strength(alert.Level) > Strength(existing.Level))
                reported[id] = alert;
        }

        var partialParents = Areas.Values
            .Where(area => area.Id is { } id && id != area.ParentId && reported.ContainsKey(id))
            .Select(area => area.ParentId).ToHashSet();
        partialParents.UnionWith(unmappedParents);

        var statuses = new List<RegionalAlert>();
        foreach (var area in Areas.Values.OrderBy(area => area.Subarea).DistinctBy(area => area.Id))
        {
            if (area.Id is not { } id) continue;
            reported.TryGetValue(id, out var specific);
            if (id != area.ParentId && reported.TryGetValue(area.ParentId, out var wholeRegion)
                && (specific is null || Strength(wholeRegion.Level) > Strength(specific.Level)))
            {
                statuses.Add(wholeRegion with { RegionId = id, Inherited = true });
            }
            else if (specific is not null)
            {
                statuses.Add(specific);
            }
            else if (id == area.ParentId && partialParents.Contains(id))
            {
                statuses.Add(new(id, "partial", null));
            }
            else if (!area.Subarea && !unmappedParents.Contains(area.ParentId))
            {
                statuses.Add(new(id, "clear", null));
            }
        }

        return new("ready", payload.UpdatedAt, statuses.AsReadOnly());
    }

    private static int Strength(string level) => level switch { "active" => 3, "warning" => 2, _ => 1 };

    private static IReadOnlyDictionary<string, FeedArea> ReadAreas()
    {
        using var stream = typeof(PublicDistrictFeed).Assembly
            .GetManifestResourceStream("KyivAlert.Api.Data.district-feed.json")
            ?? throw new InvalidOperationException("District mappings unavailable.");
        return JsonSerializer.Deserialize<FeedArea[]>(stream, JsonSerializerOptions.Web)!
            .ToDictionary(area => area.Slug);
    }

    private sealed record FeedArea(string Slug, string? Id, string ParentId, bool Subarea = false);

    internal sealed record FeedResponse(
        [property: JsonPropertyName("updated_at")] DateTimeOffset UpdatedAt,
        int? Active, IReadOnlyList<FeedAlert>? Alerts);

    internal sealed record FeedAlert(
        string? Slug, string? Level,
        [property: JsonPropertyName("oblast_slug")] string? OblastSlug,
        [property: JsonPropertyName("started_at")] DateTimeOffset? StartedAt);
}
