using KyivAlert.Telegram;
using Xunit;

namespace KyivAlert.Tests;

public sealed class MonitoringPostParserTests
{
    private static readonly DateTimeOffset Now = DateTimeOffset.Parse("2026-11-21T20:00:00Z");

    [Theory]
    [InlineData("Увага! Київська область: оголошено загрозу застосування ударних БпЛА.", "UA-32", "UAV")]
    [InlineData("🔴 м. Київ — оголошено повітряну тривогу через загрозу БпЛА типу Shahed.", "UA-30", "SHAHED")]
    [InlineData("Київська область — повітряна тривога через загрозу «Герань»", "UA-32", "SHAHED")]
    public void AcceptsStandaloneCivilNotices(string text, string region, string kind)
    {
        var signal = Assert.IsType<MonitoringSignal>(MonitoringPostParser.Parse("sample_channel", 10, Now, text));
        Assert.Equal((region, kind, Now, "https://t.me/sample_channel/10"),
            (signal.RegionId, signal.Kind, signal.PublishedAt, signal.SourceUrl));
    }

    [Theory]
    [InlineData("Шахеди курсом на Київ")]
    [InlineData("Увага! Шахеди над Києвом")]
    [InlineData("БпЛА з Броварів курсом на Київ")]
    [InlineData("Група БпЛА у Київській області, рухається на північ")]
    [InlineData("Київська область — повітряна тривога через загрозу БпЛА.\nДрони на Київ")]
    [InlineData("Київська область — повітряна тривога через загрозу БпЛА, працює ППО")]
    [InlineData("Київська область — відбій тривоги, загрози БпЛА немає")]
    [InlineData("Бориспіль — оголошено загрозу застосування ударних БпЛА")]
    [InlineData("")]
    public void RejectsSightingsNonregionalAndMixedReports(string text) =>
        Assert.Null(MonitoringPostParser.Parse("sample_channel", 10, Now, text));

    [Theory]
    [InlineData("sample_channel", true)]
    [InlineData("@sample_channel", false)]
    [InlineData("ab", false)]
    [InlineData("sample_channel\n", false)]
    [InlineData(null, false)]
    public void ValidatesChannelNames(string? name, bool expected) =>
        Assert.Equal(expected, MonitoringPostParser.IsChannelName(name));
}
