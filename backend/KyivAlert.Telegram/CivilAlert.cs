using System.Text.RegularExpressions;

namespace KyivAlert.Telegram;

public sealed record CivilAlert(
    string RegionId, bool Active, DateTimeOffset PublishedAt, string SourceUrl, bool Partial = false,
    string? DroneKind = null);

public sealed record CivilAlertsSnapshot(string Status, DateTimeOffset? CheckedAt, IReadOnlyList<CivilAlert> Alerts);

public sealed record DroneWarning(string RegionId, string Kind, string Status, DateTimeOffset PublishedAt, string SourceUrl);

public sealed record DroneWarningsSnapshot(string Status, DateTimeOffset? CheckedAt, IReadOnlyList<DroneWarning> Warnings)
{
    public static DroneWarningsSnapshot From(CivilAlertsSnapshot snapshot, DateTimeOffset now)
    {
        var available = snapshot.Status == "ready" && snapshot.CheckedAt is { } checkedAt &&
            now - checkedAt <= TimeSpan.FromMinutes(2);
        var status = !available && snapshot.Status == "ready" ? "unavailable" : snapshot.Status;
        var warnings = snapshot.Alerts
            .Where(alert => alert.Active && !alert.Partial && alert.DroneKind is not null && alert.PublishedAt <= now)
            .Select(alert => new DroneWarning(alert.RegionId, alert.DroneKind!,
                !available ? "CONNECTION LOST" :
                now - alert.PublishedAt >= TimeSpan.FromHours(2) ? "OUTDATED" : "CONFIRMED",
                alert.PublishedAt, alert.SourceUrl))
            .ToArray();
        return new(status, snapshot.CheckedAt, warnings);
    }
}

public static partial class CivilAlertParser
{
    public const string CityChannel = "VA_Kyiv";
    public const string OblastChannel = "kyivoda";

    private const string ShahedNamePattern = @"(?:Shahed|Герань|шахед(?:и|ів)?)";
    private const string ShahedVariant = @"(?:«" + ShahedNamePattern + @"»|""" + ShahedNamePattern + @"""|" + ShahedNamePattern + ")";
    private const string DroneReason = @"(?:дронову загрозу|загрозу (?:застосування )?(?:(?:ударних )?БпЛА(?: типу " +
        ShahedVariant + @")?|" + ShahedVariant + "))";

    [GeneratedRegex(@"^(?<symbol>🔴|🟡|🟢)\uFE0F?[ \t]+(?<region>м\. Київ|Київ|Київська область|Білоцерківський район|Бориспільський район|Броварський район|Бучанський район|Вишгородський район|Обухівський район|Фастівський район)[ \t]+[-–—][ \t]+(?<action>повітряна тривога|відбій повітряної тривоги)(?: через (?<reason>" + DroneReason + @"))?(?:, (?:жовтий|червоний) рівень)?[!.]?$", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex AlertHeading();

    [GeneratedRegex(@"^Оголошено повітряну тривогу через (?<reason>" + DroneReason + @")[!.]?$", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex CityDroneNotice();

    [GeneratedRegex(ShahedNamePattern, RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex ShahedName();

    public static CivilAlert? SelectLatest(
        string channel, IEnumerable<(int Id, DateTimeOffset Date, string Text)> posts)
    {
        if (channel is not (CityChannel or OblastChannel)) return null;
        var regionId = channel == CityChannel ? "UA-30" : "UA-32";
        var recentDistricts = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var hasDistrictUpdate = false;

        foreach (var (id, date, text) in posts.OrderByDescending(post => post.Id))
        {
            var newline = text.IndexOf('\n');
            var heading = (newline < 0 ? text : text[..newline]).Trim();
            var nextLine = newline < 0 ? "" : text[(newline + 1)..].Split('\n', 2)[0].Trim();
            if (channel == CityChannel && id > 0 && ParseCityNotice(heading, nextLine) is { } cityActive)
            {
                return new(regionId, cityActive, date, $"https://t.me/{channel}/{id}",
                    DroneKind: cityActive ? ClassifyReason(CityDroneNotice().Match(nextLine).Groups["reason"]) : null);
            }

            var match = AlertHeading().Match(heading);
            if (!match.Success || id <= 0) continue;

            var active = !match.Groups["action"].Value.StartsWith("відбій", StringComparison.OrdinalIgnoreCase);
            var symbol = match.Groups["symbol"].Value;
            if (active == (symbol == "🟢") || (!active && match.Groups["reason"].Success)) continue;

            var region = match.Groups["region"].Value;
            var city = region.Equals("м. Київ", StringComparison.OrdinalIgnoreCase) ||
                region.Equals("Київ", StringComparison.OrdinalIgnoreCase);
            if (city != (channel == CityChannel)) continue;

            var district = region.EndsWith(" район", StringComparison.OrdinalIgnoreCase);
            if (!district)
            {
                return hasDistrictUpdate ? null : new(regionId, active, date, $"https://t.me/{channel}/{id}",
                    DroneKind: ClassifyReason(match.Groups["reason"]));
            }

            hasDistrictUpdate = true;
            if (recentDistricts.Add(region) && active)
                return new(regionId, true, date, $"https://t.me/{channel}/{id}", Partial: true);
        }
        return null;
    }

    private static string? ClassifyReason(Group reason) =>
        !reason.Success ? null : ShahedName().IsMatch(reason.Value) ? "SHAHED" : "UAV";

    private static bool? ParseCityNotice(string heading, string nextLine)
    {
        heading = heading.Replace("\uFE0F", "").TrimEnd('.', '!');
        if (heading == "🟢 Відбій повітряної тривоги") return false;

        if (heading is not ("🟡 Жовтий рівень небезпеки" or "🔴 Червоний рівень небезпеки"))
            return null;

        return nextLine.StartsWith("Оголошено повітряну тривогу", StringComparison.OrdinalIgnoreCase)
            ? true
            : null;
    }
}
