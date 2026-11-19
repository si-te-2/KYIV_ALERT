using KyivAlert.Core;

namespace KyivAlert.Infrastructure;

public sealed class DemoSnapshotProvider(TimeProvider clock) : ISystemSnapshotProvider
{
    private static readonly IReadOnlyList<AlertSource> Sources = Array.AsReadOnly<AlertSource>(
    [
        new("Локальне демонстраційне джерело", "DEMO", null),
        TelegramSource("ukraine_pyxx"),
        TelegramSource("smolii_ukraine"),
        TelegramSource("kyiv_nebo"),
        TelegramSource("StrategicaviationT"),
        TelegramSource("kpszsu"),
        TelegramSource("ppo_kiev"),
        TelegramSource("kievinfo_kyiv"),
    ]);

    private readonly DateTimeOffset startedAt = clock.GetUtcNow();
    private readonly Guid messageId = Guid.NewGuid();

    public SystemSnapshot GetSnapshot() => new(
        "KYIV ALERT", true, "STOPPED", "NOT_CONFIGURED", clock.GetUtcNow(), Sources,
        [new AlertMessage(messageId,
            "Тестове повідомлення. Панель KYIV ALERT готова до локальної розробки.",
            "UNVERIFIED", true, startedAt, "Локальна DEMO-подія", null)]);

    private static AlertSource TelegramSource(string username) =>
        new("@" + username, "PENDING_ACCESS", $"https://t.me/{username}");
}
