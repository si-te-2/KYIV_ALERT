using System.Net.Http.Json;
using KyivAlert.Telegram;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace KyivAlert.Tests;

public sealed class DroneWarningTests
{
    private static readonly DateTimeOffset Now = DateTimeOffset.Parse("2026-11-21T20:00:00Z");

    [Theory]
    [InlineData("VA_Kyiv", "🟡 Жовтий рівень небезпеки\nОголошено повітряну тривогу через дронову загрозу.", "UAV")]
    [InlineData("kyivoda", "🔴 Київська область — повітряна тривога через загрозу застосування ударних БпЛА.", "UAV")]
    [InlineData("kyivoda", "🔴 Київська область — повітряна тривога через загрозу «Герань».", "SHAHED")]
    [InlineData("VA_Kyiv", "🔴 м. Київ — повітряна тривога через загрозу Shahed", "SHAHED")]
    [InlineData("kyivoda", "🔴 Київська область — повітряна тривога через загрозу застосування ударних БпЛА типу «Шахед».", "SHAHED")]
    [InlineData("VA_Kyiv", "🟡 Жовтий рівень небезпеки\nОголошено повітряну тривогу через загрозу БпЛА типу Shahed.", "SHAHED")]
    public void ReadsOnlyExplicitCivilReason(string source, string text, string kind)
    {
        var alert = Assert.IsType<CivilAlert>(CivilAlertParser.SelectLatest(source, [(4, Now, text)]));
        Assert.Equal(kind, alert.DroneKind);
        Assert.Equal($"https://t.me/{source}/4", alert.SourceUrl);
    }

    [Theory]
    [InlineData("unknown", "🔴 м. Київ — повітряна тривога через загрозу БпЛА")]
    [InlineData("VA_Kyiv", "🟡 Жовтий рівень небезпеки\nОголошено повітряну тривогу, але загрози БпЛА немає.")]
    [InlineData("VA_Kyiv", "🔴 м. Київ — повітряна тривога.\nУ дописі процитовано згадку про Shahed.")]
    [InlineData("VA_Kyiv", "шахед на Вишгород")]
    [InlineData("kyivoda", "БпЛА з Броварів курсом на Київ")]
    [InlineData("VA_Kyiv", "🔴 м. Київ — повітряна тривога.\nПовідомляють: «шахед на Вишгород».")]
    [InlineData("kyivoda", "🟡 Бучанський район — повітряна тривога через загрозу БпЛА")]
    [InlineData("kyivoda", "Неперевірена згадка про БпЛА.")]
    public void DoesNotConvertAmbiguousOrSubregionalTextIntoWarnings(string source, string text) =>
        Assert.Null(CivilAlertParser.SelectLatest(source, [(4, Now, text)])?.DroneKind);

    [Fact]
    public void NewerAllClearSupersedesRepostedWarnings()
    {
        var warning = "🔴 м. Київ — повітряна тривога через загрозу БпЛА";
        var result = CivilAlertParser.SelectLatest("VA_Kyiv",
            [(1, Now.AddMinutes(-15), warning), (2, Now.AddMinutes(-14), warning),
             (3, Now, "🟢 Відбій повітряної тривоги.")]);
        Assert.NotNull(result);
        Assert.Null(result.DroneKind);
        Assert.False(result.Active);
    }

    [Fact]
    public void KeepsSimultaneousRegionalWarningsSeparate()
    {
        var city = Assert.IsType<CivilAlert>(CivilAlertParser.SelectLatest("VA_Kyiv",
            [(4, Now.AddMinutes(-3), "🔴 м. Київ — повітряна тривога через загрозу Shahed")]));
        var oblast = Assert.IsType<CivilAlert>(CivilAlertParser.SelectLatest("kyivoda",
            [(9, Now.AddMinutes(-2), "🔴 Київська область — повітряна тривога через загрозу ударних БпЛА")]));
        var result = DroneWarningsSnapshot.From(new("ready", Now, [city, oblast]), Now);

        Assert.Collection(result.Warnings,
            warning =>
            {
                Assert.Equal(("UA-30", "SHAHED", "CONFIRMED"), (warning.RegionId, warning.Kind, warning.Status));
                Assert.Equal("https://t.me/VA_Kyiv/4", warning.SourceUrl);
            },
            warning =>
            {
                Assert.Equal(("UA-32", "UAV", "CONFIRMED"), (warning.RegionId, warning.Kind, warning.Status));
                Assert.Equal("https://t.me/kyivoda/9", warning.SourceUrl);
            });
    }

    [Theory]
    [InlineData(1, 45, "ready", "CONFIRMED")]
    [InlineData(125, 45, "ready", "OUTDATED")]
    [InlineData(3, 180, "ready", "CONNECTION LOST")]
    [InlineData(3, 45, "unavailable", "CONNECTION LOST")]
    public void AppliesAgeAndConnectionSeparately(int postAgeMinutes, int syncAgeSeconds, string status, string badge)
    {
        var alert = new CivilAlert("UA-30", true, Now.AddMinutes(-postAgeMinutes), "https://t.me/VA_Kyiv/4", DroneKind: "UAV");
        var result = DroneWarningsSnapshot.From(new(status, Now.AddSeconds(-syncAgeSeconds), [alert]), Now);
        Assert.Equal(badge, Assert.Single(result.Warnings).Status);
    }

    [Fact]
    public async Task DisabledFeedNeverReturnsPlaceholderWarnings()
    {
        await using var factory = new WebApplicationFactory<Program>();
        using var client = factory.CreateClient();
        var feed = await client.GetFromJsonAsync<DroneWarningsSnapshot>("/api/drone-warnings");
        Assert.NotNull(feed);
        Assert.Equal("disabled", feed.Status);
        Assert.Null(feed.CheckedAt);
        Assert.Empty(feed.Warnings);
    }
}
