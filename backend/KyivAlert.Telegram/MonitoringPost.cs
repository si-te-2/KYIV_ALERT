using System.Text.RegularExpressions;

namespace KyivAlert.Telegram;

/// <summary>
/// Region-level drone signal taken from an unofficial public monitoring channel. It never carries
/// coordinates, trajectories or the original text: only the territory, the drone class and a link to the post.
/// </summary>
public sealed record MonitoringSignal(string RegionId, string Kind, DateTimeOffset PublishedAt, string SourceUrl);

/// <summary>
/// Turns explicit region names in monitoring posts into administrative-area warnings.
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

    private static readonly string[] ShahedNames = ["шахед", "shahed", "герань", "герані", "гераней", "geran"];
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

    private static readonly (string RegionId, Regex Mentions)[] OtherRegions =
        new Dictionary<string, string>
        {
            ["UA-05"] = @"вінниччин\w*|вінницьк\w*\s+обл\w*",
            ["UA-07"] = @"волин(?:ь|і|ню)|волинськ\w*\s+обл\w*",
            ["UA-09"] = @"луганщин\w*|луганськ\w*\s+обл\w*",
            ["UA-12"] = @"дніпропетровщин\w*|дніпропетровськ\w*\s+обл\w*",
            ["UA-14"] = @"донеччин\w*|донецьк\w*\s+обл\w*",
            ["UA-18"] = @"житомирщин\w*|житомирськ\w*\s+обл\w*",
            ["UA-21"] = @"закарпатт\w*|закарпатськ\w*\s+обл\w*",
            ["UA-23"] = @"запоріжж\w*|запорізьк\w*\s+обл\w*",
            ["UA-26"] = @"прикарпатт\w*|івано[\s-]франківщин\w*|івано[\s-]франківськ\w*\s+обл\w*",
            ["UA-35"] = @"кіровоградщин\w*|кіровоградськ\w*\s+обл\w*",
            ["UA-40"] = @"севастопол\w*",
            ["UA-43"] = @"крим(?:у|ом)?|автономн\w*\s+республік\w*\s+крим",
            ["UA-46"] = @"львівщин\w*|львівськ\w*\s+обл\w*",
            ["UA-48"] = @"миколаївщин\w*|миколаївськ\w*\s+обл\w*|микола(?:їв|єва|єві|євом)",
            ["UA-51"] = @"одещин\w*|одеськ\w*\s+обл\w*|одес(?:а|и|і|у|ою)",
            ["UA-53"] = @"полтавщин\w*|полтавськ\w*\s+обл\w*|полтав(?:а|и|і|у|ою)",
            ["UA-56"] = @"рівненщин\w*|рівненськ\w*\s+обл\w*",
            ["UA-59"] = @"сумщин\w*|сумськ\w*\s+обл\w*|сум(?:и|ах|ам|ами)",
            ["UA-61"] = @"тернопільщин\w*|тернопільськ\w*\s+обл\w*",
            ["UA-63"] = @"харківщин\w*|харківськ\w*\s+обл\w*|харків|харков(?:а|і|ом|у)",
            ["UA-65"] = @"херсонщин\w*|херсонськ\w*\s+обл\w*|херсон(?:а|і|у|ом)?",
            ["UA-68"] = @"хмельниччин\w*|хмельницьк\w*\s+обл\w*",
            ["UA-71"] = @"черкащин\w*|черкаськ\w*\s+обл\w*",
            ["UA-74"] = @"чернігівщин\w*|чернігівськ\w*\s+обл\w*",
            ["UA-77"] = @"буковин\w*|чернівецьк\w*\s+обл\w*",
        }.Select(entry => (entry.Key, new Regex(@"\b(?:" + entry.Value + @")\b", Options, MatchTimeout))).ToArray();

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
        foreach (var (regionId, mentions) in OtherRegions)
            if (mentions.IsMatch(cleaned)) signals.Add(new(regionId, kind, date, url));
        return signals;
    }
}
