using System.Text.RegularExpressions;

namespace KyivAlert.Telegram;

public sealed record MonitoringSignal(string RegionId, string Kind, DateTimeOffset PublishedAt, string SourceUrl);

public static partial class MonitoringPostParser
{
    public static readonly TimeSpan SignalLifetime = TimeSpan.FromMinutes(30);

    [GeneratedRegex(@"\A[A-Za-z][A-Za-z0-9_]{4,31}\z", RegexOptions.CultureInvariant)]
    private static partial Regex ChannelName();

    [GeneratedRegex(@"\A(?:(?:🔴|🟡)\uFE0F?[ \t]+|Увага![ \t]+)?(?<region>м\. Київ|Київ|Київська область)[ \t]*(?::|[-–—])[ \t]*(?:оголошено|оголошено повітряну тривогу через|повітряна тривога через)[ \t]+(?<reason>" +
        CivilAlertParser.DroneReason + @")[!.]?\z", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex RegionalNotice();

    public static bool IsChannelName(string? name) => name is not null && ChannelName().IsMatch(name);

    public static MonitoringSignal? Parse(string channel, int id, DateTimeOffset date, string? text)
    {
        if (id <= 0 || !IsChannelName(channel) || string.IsNullOrWhiteSpace(text) || text.Length > 240)
            return null;

        var notice = RegionalNotice().Match(text.Trim());
        if (!notice.Success || CivilAlertParser.ClassifyReason(notice.Groups["reason"]) is not { } kind)
            return null;

        var region = notice.Groups["region"].Value.Equals("Київська область", StringComparison.OrdinalIgnoreCase)
            ? "UA-32" : "UA-30";
        return new(region, kind, date, $"https://t.me/{channel}/{id}");
    }
}
