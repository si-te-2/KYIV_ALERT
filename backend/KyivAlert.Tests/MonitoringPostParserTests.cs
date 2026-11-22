using KyivAlert.Telegram;
using Xunit;

namespace KyivAlert.Tests;

public sealed class MonitoringPostParserTests
{
    private static readonly DateTimeOffset Now = DateTimeOffset.Parse("2026-11-21T20:00:00Z");

    [Theory]
    [InlineData("Шахеди курсом на Київ", "UA-30", "SHAHED")]
    [InlineData("Герань-2 на Київщину", "UA-32", "SHAHED")]
    [InlineData("Група БпЛА у Київській області, рухається на північ", "UA-32", "UAV")]
    [InlineData("Увага! Шахеди над Києвом", "UA-30", "SHAHED")]
    [InlineData("Дрони з боку Борисполя", "UA-32", "UAV")]
    [InlineData("Шахеди в районі Вишгорода", "UA-32", "SHAHED")]
    [InlineData("Шахеди на Київ https://t.me/ukraine_pyxx/12 #київ", "UA-30", "SHAHED")]
    [InlineData("Загроза Shahed на Одещині", "UA-51", "SHAHED")]
    [InlineData("Герані на Сумщині", "UA-59", "SHAHED")]
    [InlineData("Шахеди курсом на Харківщину", "UA-63", "SHAHED")]
    [InlineData("Шахеди курсом на Харківщину\n@kyiv_nebo", "UA-63", "SHAHED")]
    [InlineData("Шахеди на Київський район Харкова", "UA-63", "SHAHED")]
    [InlineData("БпЛА на Херсонщині", "UA-65", "UAV")]
    [InlineData("Загроза БпЛА у Дніпропетровській області", "UA-12", "UAV")]
    [InlineData("Shahed на Чернігівщині", "UA-74", "SHAHED")]
    public void ReadsRegionLevelSignals(string text, string region, string kind)
    {
        var signal = Assert.Single(MonitoringPostParser.Parse("kyiv_nebo", 10, Now, text));
        Assert.Equal((region, kind), (signal.RegionId, signal.Kind));
        Assert.Equal("https://t.me/kyiv_nebo/10", signal.SourceUrl);
        Assert.Equal(Now, signal.PublishedAt);
    }

    [Fact]
    public void ReportsBothTerritoriesWhenBothAreNamed()
    {
        var signals = MonitoringPostParser.Parse("kyiv_nebo", 11, Now, "БпЛА з Броварів курсом на Київ");
        Assert.Collection(signals,
            signal => Assert.Equal(("UA-30", "UAV"), (signal.RegionId, signal.Kind)),
            signal => Assert.Equal(("UA-32", "UAV"), (signal.RegionId, signal.Kind)));
    }

    [Theory]
    [InlineData("Немає загрози БпЛА на Одещині")]
    [InlineData("https://t.me/war_monitor/10 #Сумщина БпЛА")]
    [InlineData("БпЛА над Києвом, працює ППО")]
    [InlineData("Приліт шахеда у Київській області")]
    [InlineData("Загроза БпЛА у Києві минула, відбій")]
    [InlineData("Над Києвом чисто, БпЛА немає")]
    [InlineData("Дрони на Київ. Збито 5 цілей")]
    [InlineData("Мобільні групи працюють по БпЛА над Києвом")]
    [InlineData("Навчальна тривога: умовні шахеди на Київ")]
    [InlineData("Київ, Бровари, Бориспіль")]
    [InlineData("https://t.me/ukraine_pyxx/123 БпЛА")]
    [InlineData("")]
    public void DropsAmbiguousSensitiveAndNegatedPosts(string text) =>
        Assert.Empty(MonitoringPostParser.Parse("kyiv_nebo", 10, Now, text));

    [Fact]
    public void MultipleRegionsAreIndependentWarningsFromOnePost()
    {
        var signals = MonitoringPostParser.Parse("war_monitor", 12, Now,
            "Загроза Shahed на Одещині, Миколаївщині та Полтавщині.");
        Assert.Equal(new[] { "UA-48", "UA-51", "UA-53" }, signals.Select(signal => signal.RegionId));
        Assert.All(signals, signal => Assert.Equal("https://t.me/war_monitor/12", signal.SourceUrl));
    }

    [Fact]
    public void DropsLongDigestsAndInvalidInput()
    {
        Assert.Empty(MonitoringPostParser.Parse("kyiv_nebo", 10, Now, "Шахеди на Київ " + new string('а', 600)));
        Assert.Empty(MonitoringPostParser.Parse("kyiv_nebo", 0, Now, "Шахеди на Київ"));
        Assert.Empty(MonitoringPostParser.Parse("bad name", 10, Now, "Шахеди на Київ"));
        Assert.Empty(MonitoringPostParser.Parse("kyiv_nebo", 10, Now, null));
    }

    [Theory]
    [InlineData("kyiv_nebo", true)]
    [InlineData("@kyiv_nebo", false)]
    [InlineData("ab", false)]
    [InlineData("kyiv_nebo\n", false)]
    [InlineData(null, false)]
    public void AcceptsOnlyValidPublicChannelNames(string? name, bool expected) =>
        Assert.Equal(expected, MonitoringPostParser.IsChannelName(name));
}
