using KyivAlert.Telegram;
using Xunit;

namespace KyivAlert.Tests;

public sealed class CivilAlertParserTests
{
    [Theory]
    [InlineData("VA_Kyiv", "🔴 м. Київ - повітряна тривога!", "UA-30", true, false)]
    [InlineData("VA_Kyiv", "🟢 Відбій повітряної тривоги.", "UA-30", false, false)]
    [InlineData("VA_Kyiv", "🟡 Жовтий рівень небезпеки\nОголошено повітряну тривогу через дронову загрозу.", "UA-30", true, false)]
    [InlineData("VA_Kyiv", "🟢 м. Київ — відбій повітряної тривоги.", "UA-30", false, false)]
    [InlineData("kyivoda", "🔴 Київська область - повітряна тривога!", "UA-32", true, false)]
    [InlineData("kyivoda", "🟢 Київська область — відбій повітряної тривоги", "UA-32", false, false)]
    [InlineData("kyivoda", "🟡 Бучанський район — повітряна тривога, жовтий рівень", "UA-32", true, true)]
    public void UsesExplicitOfficialNotices(string channel, string text, string area, bool active, bool partial)
    {
        var date = DateTimeOffset.UnixEpoch;
        var result = Assert.IsType<CivilAlert>(CivilAlertParser.SelectLatest(channel, [(101, date, text)]));

        Assert.Equal(area, result.RegionId);
        Assert.Equal(active, result.Active);
        Assert.Equal(partial, result.Partial);
        Assert.Equal(date, result.PublishedAt);
        Assert.Equal($"https://t.me/{channel}/101", result.SourceUrl);
    }

    [Fact]
    public void DistrictAllClearDoesNotClearOtherDistrictsOrTheWholeOblast()
    {
        var date = DateTimeOffset.UnixEpoch;
        var result = CivilAlertParser.SelectLatest("kyivoda",
        [
            (101, date, "🟡 Бучанський район — повітряна тривога, жовтий рівень"),
            (102, date, "🔴 Фастівський район — повітряна тривога"),
            (103, date, "🟢 Фастівський район — відбій повітряної тривоги"),
        ]);

        Assert.Equal("https://t.me/kyivoda/101", result?.SourceUrl);
        Assert.True(result?.Partial);

        Assert.Null(CivilAlertParser.SelectLatest("kyivoda",
        [
            (101, date, "🟢 Київська область — відбій повітряної тривоги"),
            (102, date, "🔴 Фастівський район — повітряна тривога"),
            (103, date, "🟢 Фастівський район — відбій повітряної тривоги"),
        ]));
    }

    [Theory]
    [InlineData("VA_Kyiv", "🟡 Жовтий рівень небезпеки\nІнформаційне повідомлення.")]
    [InlineData("kyivoda", "🟡 Київська область — відбій повітряної тривоги")]
    [InlineData("unknown", "🔴 м. Київ — повітряна тривога")]
    [InlineData("VA_Kyiv", "🟢 м. Київ — повітряна тривога")]
    [InlineData("VA_Kyiv", "Новини\n🔴 м. Київ — повітряна тривога")]
    [InlineData("VA_Kyiv", "🔴 Київська область — повітряна тривога")]
    public void IgnoresUnofficialSourcesAndAmbiguousHeadings(string channel, string text) =>
        Assert.Null(CivilAlertParser.SelectLatest(channel, [(101, DateTimeOffset.UnixEpoch, text)]));
}
