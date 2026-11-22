using KyivAlert.Telegram;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace KyivAlert.Tests;

public sealed class TelegramSessionStorageTests : IDisposable
{
    private readonly string directory = Path.Combine(Path.GetTempPath(), "kyiv-alert-storage-test-" + Guid.NewGuid());

    [Fact]
    public void SecretSeedBootstrapsSessionAndNeverOverwritesUpdatedSession()
    {
        Directory.CreateDirectory(directory);
        var seed = Path.Combine(directory, "seed.txt");
        File.WriteAllText(seed, Convert.ToBase64String([1, 2, 3]));
        var config = Configuration(seed);
        var session = TelegramSessionStorage.Prepare(config);
        Assert.Equal(new byte[] { 1, 2, 3 }, File.ReadAllBytes(session));
        File.WriteAllBytes(session, [4, 5]);
        TelegramSessionStorage.Prepare(config);
        Assert.Equal(new byte[] { 4, 5 }, File.ReadAllBytes(session));
    }

    [Theory]
    [InlineData("invalid base64")]
    [InlineData("")]
    public void InvalidSecretDoesNotCreateSession(string contents)
    {
        Directory.CreateDirectory(directory);
        var seed = Path.Combine(directory, "seed.txt");
        File.WriteAllText(seed, contents);
        Assert.Throws<InvalidOperationException>(() => TelegramSessionStorage.Prepare(Configuration(seed)));
        Assert.False(File.Exists(Path.Combine(directory, "private", "account.session")));
    }

    private IConfiguration Configuration(string seed) => new ConfigurationBuilder().AddInMemoryCollection(
        new Dictionary<string, string?>
        {
            ["Telegram:SessionDirectory"] = Path.Combine(directory, "private"),
            ["Telegram:SessionSeedFile"] = seed,
        }).Build();

    public void Dispose()
    {
        if (Directory.Exists(directory)) Directory.Delete(directory, recursive: true);
    }
}
