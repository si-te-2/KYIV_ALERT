using KyivAlert.Core;

namespace KyivAlert.Infrastructure;

public sealed class DemoSnapshotProvider(TimeProvider clock) : ISystemSnapshotProvider
{
    private readonly DateTimeOffset startedAt = clock.GetUtcNow();
    private readonly Guid messageId = Guid.NewGuid();

    public SystemSnapshot GetSnapshot() => new(
        "KYIV ALERT", true, "STOPPED", "NOT_CONFIGURED", clock.GetUtcNow(),
        [new AlertSource("Локальне демонстраційне джерело", "DEMO", null)],
        [new AlertMessage(messageId,
            "Тестове повідомлення. Панель KYIV ALERT готова до локальної розробки.",
            "UNVERIFIED", true, startedAt, "Локальна DEMO-подія", null)]);
}
