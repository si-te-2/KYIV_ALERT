namespace KyivAlert.Core;

public sealed record SystemSnapshot(
    string Name,
    bool DemoMode,
    string MonitoringStatus,
    string TelegramStatus,
    DateTimeOffset CheckedAt,
    IReadOnlyList<AlertSource> Sources,
    IReadOnlyList<AlertMessage> Messages);

public sealed record AlertSource(string Name, string Status, string? OriginalUrl);

public sealed record AlertMessage(
    Guid Id, string Text, string Classification, bool IsTest,
    DateTimeOffset CreatedAt, string SourceName, string? OriginalUrl);

public interface ISystemSnapshotProvider
{
    SystemSnapshot GetSnapshot();
}
