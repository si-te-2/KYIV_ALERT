using System.Text.RegularExpressions;

namespace KyivAlert.Telegram;

public sealed record CivilAlert(
    string RegionId, bool Active, DateTimeOffset PublishedAt, string SourceUrl, bool Partial = false);

public sealed record CivilAlertsSnapshot(string Status, DateTimeOffset? CheckedAt, IReadOnlyList<CivilAlert> Alerts);

public static partial class CivilAlertParser
{
    public const string CityChannel = "VA_Kyiv";
    public const string OblastChannel = "kyivoda";

    [GeneratedRegex(@"^(?<symbol>🔴|🟡|🟢)\uFE0F?[ \t]+(?<region>м\. Київ|Київ|Київська область|Білоцерківський район|Бориспільський район|Броварський район|Бучанський район|Вишгородський район|Обухівський район|Фастівський район)[ \t]+[-–—][ \t]+(?<action>повітряна тривога|відбій повітряної тривоги)(?:, (?:жовтий|червоний) рівень)?[!.]?$", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex AlertHeading();

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
            if (channel == CityChannel && id > 0 && ParseCityNotice(heading, newline < 0 ? "" : text[(newline + 1)..]) is { } cityActive)
            {
                return new(regionId, cityActive, date, $"https://t.me/{channel}/{id}");
            }

            var match = AlertHeading().Match(heading);
            if (!match.Success || id <= 0) continue;

            var active = !match.Groups["action"].Value.StartsWith("відбій", StringComparison.OrdinalIgnoreCase);
            var symbol = match.Groups["symbol"].Value;
            if (active == (symbol == "🟢")) continue;

            var region = match.Groups["region"].Value;
            var city = region.Equals("м. Київ", StringComparison.OrdinalIgnoreCase) ||
                region.Equals("Київ", StringComparison.OrdinalIgnoreCase);
            if (city != (channel == CityChannel)) continue;

            var district = region.EndsWith(" район", StringComparison.OrdinalIgnoreCase);
            if (!district)
            {
                return hasDistrictUpdate ? null : new(regionId, active, date, $"https://t.me/{channel}/{id}");
            }

            hasDistrictUpdate = true;
            if (recentDistricts.Add(region) && active)
                return new(regionId, true, date, $"https://t.me/{channel}/{id}", Partial: true);
        }
        return null;
    }

    private static bool? ParseCityNotice(string heading, string details)
    {
        heading = heading.Replace("\uFE0F", "").TrimEnd('.', '!');
        if (heading == "🟢 Відбій повітряної тривоги") return false;

        if (heading is not ("🟡 Жовтий рівень небезпеки" or "🔴 Червоний рівень небезпеки"))
            return null;

        var nextLine = details.Split('\n', 2)[0].Trim();
        return nextLine.StartsWith("Оголошено повітряну тривогу", StringComparison.OrdinalIgnoreCase)
            ? true
            : null;
    }
}
