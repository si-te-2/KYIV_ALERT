using Microsoft.Extensions.Configuration;

namespace KyivAlert.Telegram;

public static class TelegramSessionStorage
{
    // Never place this directory inside wwwroot or the repository.
    public static string Prepare(IConfiguration configuration)
    {
        var directory = configuration["Telegram:SessionDirectory"] ?? Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "KyivAlert", "Telegram");
        if (!Path.IsPathFullyQualified(directory))
            throw new InvalidOperationException("Telegram:SessionDirectory must be an absolute private path.");
        var sessionPath = Path.Combine(directory, "account.session");
        if (File.Exists(sessionPath)) return sessionPath;

        var seedFile = configuration["Telegram:SessionSeedFile"];
        if (string.IsNullOrEmpty(seedFile)) return sessionPath;
        if (!Path.IsPathFullyQualified(seedFile) || !File.Exists(seedFile) ||
            new FileInfo(seedFile).Length > 1_048_576)
            throw new InvalidOperationException("Telegram session secret file is missing or invalid.");

        byte[] session;
        try { session = Convert.FromBase64String(File.ReadAllText(seedFile)); }
        catch (FormatException) { throw new InvalidOperationException("Telegram session secret file is invalid."); }
        if (session.Length == 0)
            throw new InvalidOperationException("Telegram session secret file is empty.");

        Directory.CreateDirectory(directory);
        if (!OperatingSystem.IsWindows())
            File.SetUnixFileMode(directory, UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.UserExecute);
        // CreateNew prevents replacing a session that has already been updated by WTelegram.
        using var output = new FileStream(sessionPath, FileMode.CreateNew, FileAccess.Write, FileShare.None);
        if (!OperatingSystem.IsWindows())
            File.SetUnixFileMode(sessionPath, UnixFileMode.UserRead | UnixFileMode.UserWrite);
        output.Write(session);
        System.Security.Cryptography.CryptographicOperations.ZeroMemory(session);
        return sessionPath;
    }
}
