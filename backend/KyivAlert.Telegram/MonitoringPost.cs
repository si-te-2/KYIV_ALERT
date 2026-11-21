using System.Text.RegularExpressions;

namespace KyivAlert.Telegram;

/// <summary>
/// Region-level drone signal taken from an unofficial public monitoring channel. It never carries
/// coordinates, trajectories or the original text: only the territory, the drone class and a link to the post.
/// </summary>
public sealed record MonitoringSignal(string RegionId, string Kind, DateTimeOffset PublishedAt, string SourceUrl);

/// <summary>
/// Turns a post from a monitoring channel into at most two region-level signals (Kyiv city, Kyiv oblast).
/// The parser is deliberately conservative: when a post is ambiguous, or touches impacts and air defence,
/// it produces nothing.
/// </summary>
public static class MonitoringPostParser
{
    public const string CityRegionId = "UA-30";
    public const string OblastRegionId = "UA-32";

    /// <summary>Real-time warnings are short. Longer posts are digests, analysis or advertising.</summary>
    public const int MaxPostLength = 500;

    /// <summary>How long an unofficial signal stays on the map after the post was published.</summary>
    public static readonly TimeSpan SignalLifetime = TimeSpan.FromMinutes(30);

    private const RegexOptions Options = RegexOptions.IgnoreCase | RegexOptions.CultureInvariant;
    private static readonly TimeSpan MatchTimeout = TimeSpan.FromMilliseconds(100);

    private static readonly string[] ShahedNames = ["шахед", "shahed", "герань", "geran"];
    private static readonly string[] DroneNames = ["бпла", "дрон", "безпілотн", "uav"];

    // A post about impacts, damage or air-defence activity is dropped as a whole instead of being redacted.
    // The map shows where people should take cover, not what was hit and not how the defence works.
    private static readonly string[] SensitiveStems =
    [
        "приліт", "прильот", "вибух", "вибуч", "влуч", "уражен", "детонац", "уламк", "наслід",
        "пошкодж", "руйнув", "зруйнов", "пожеж", "загин", "постражд", "поранен",
        "протиповітр", "збит", "збив", "знищен", "мобільн", "вогнев",
    ];

    // All-clear, "nothing is flying" and training posts are not threats.
    private static readonly string[] NegatingStems =
    [
        "нема", "відсутн", "відбій", "відбою", "чисто", "тихо", "не фіксу", "не зафікс", "без загроз",
        "навчальн", "тестов",
    ];

    private static readonly Regex Abbreviations = new(@"\b(?:ппо|мвг)\b", Options, MatchTimeout);
    private static readonly Regex Noise = new(@"https?://\S+|t\.me/\S+|@\w+|#\w+", Options, MatchTimeout);

    // "Київський район" exists in Kharkiv, Odesa and Poltava. It is not Kyiv.
    private static readonly Regex OtherKyivDistrict = new(@"київськ\w*\s+район\w*", Options, MatchTimeout);

    private static readonly Regex City = new(@"\b(?:київ|києв\w*)\b", Options, MatchTimeout);

    private static readonly Regex Oblast = new(
        @"київщин\w*|київськ\w*\s+обл\w*" +
        @"|\b(?:бровар|бориспіл|бориспол|ірпін|ірпен|вишгород|фастів|фастов|обухів|обухов|гостомел|бородянк|білоцерківськ|бучанськ)\w*" +
        @"|\bбіл\w+\s+церкв\w*|\bбуч(?:а|і|у|ею)\b|\bвасильк(?:ів|ова|ові|ову|овом)\b",
        Options, MatchTimeout);

    private static readonly Regex ChannelName = new(@"^[A-Za-z][A-Za-z0-9_]{4,31}\z", RegexOptions.CultureInvariant, MatchTimeout);

    public static bool IsChannelName(string? name) => name is not null && ChannelName.IsMatch(name);

    public static IReadOnlyList<MonitoringSignal> Parse(string channel, int id, DateTimeOffset date, string? text)
    {
        if (id <= 0 || !IsChannelName(channel) || string.IsNullOrWhiteSpace(text) || text.Length > MaxPostLength)
            return [];

        // Links, handles and hashtags are removed first: channel signatures often contain a city name.
        var cleaned = OtherKyivDistrict.Replace(Noise.Replace(text, " "), " ").ToLowerInvariant();

        var shahed = ShahedNames.Any(name => cleaned.Contains(name, StringComparison.Ordinal));
        if (!shahed && !DroneNames.Any(name => cleaned.Contains(name, StringComparison.Ordinal))) return [];

        if (Abbreviations.IsMatch(cleaned) ||
            SensitiveStems.Any(stem => cleaned.Contains(stem, StringComparison.Ordinal)) ||
            NegatingStems.Any(stem => cleaned.Contains(stem, StringComparison.Ordinal)))
            return [];

        var kind = shahed ? "SHAHED" : "UAV";
        var url = $"https://t.me/{channel}/{id}";
        var signals = new List<MonitoringSignal>(2);
        if (City.IsMatch(cleaned)) signals.Add(new(CityRegionId, kind, date, url));
        if (Oblast.IsMatch(cleaned)) signals.Add(new(OblastRegionId, kind, date, url));
        return signals;
    }
}
