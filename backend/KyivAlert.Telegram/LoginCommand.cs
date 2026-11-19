using System.Globalization;
using System.Text;
using Microsoft.Extensions.Configuration;

namespace KyivAlert.Telegram;

internal static class LoginCommand
{
    public static async Task<int> Main(string[] args)
    {
        if (args.Length != 1 || (args[0] != "--check-config" && args[0] != "--login"))
        {
            Console.WriteLine("Use --check-config to validate local credentials or --login to sign in locally.");
            return 2;
        }

        using var config = new ConfigurationManager();
        config.AddUserSecrets("kyiv-alert-telegram-local")
            .AddEnvironmentVariables("KYIVALERT_");

        var apiHash = config["Telegram:ApiHash"];
        if (!int.TryParse(config["Telegram:ApiId"], out var apiId) || apiId <= 0 ||
            apiHash is null || apiHash.Length != 32 || !apiHash.All(Uri.IsHexDigit))
        {
            Console.Error.WriteLine("Configure Telegram:ApiId and Telegram:ApiHash in the local .NET user-secret store.");
            return 2;
        }

        if (args[0] == "--check-config")
        {
            Console.WriteLine("Local Telegram application credentials are configured. Account login is a separate step.");
            return 0;
        }

        if (Console.IsInputRedirected)
        {
            Console.Error.WriteLine("Open an interactive terminal to enter your phone, Telegram code and optional 2FA password.");
            return 2;
        }

        var dataDirectory = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "KyivAlert", "Telegram");
        Directory.CreateDirectory(dataDirectory);
        var sessionPath = Path.Combine(dataDirectory, "account.session");
        if (!OperatingSystem.IsWindows())
        {
            File.SetUnixFileMode(dataDirectory, UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.UserExecute);
        }

        Console.WriteLine("KYIV ALERT - local Telegram account setup");
        Console.WriteLine("This creates or resumes a Telegram client session on this computer.");
        Console.WriteLine("Continue only with your own account. Press Ctrl+C to cancel.");
        Console.WriteLine("The application stays in DEMO MODE after login.");

        string? GetConfiguration(string key) => key switch
        {
            "api_id" => apiId.ToString(CultureInfo.InvariantCulture),
            "api_hash" => apiHash,
            "session_pathname" => sessionPath,
            "device_model" => "KYIV ALERT local setup",
            "app_version" => "0.2",
            "phone_number" => ReadPrivateInput("Your phone number, including country code: "),
            "verification_code" => ReadPrivateInput("Telegram login code: "),
            "password" => ReadPrivateInput("Telegram 2FA password: "),
            "email" => ReadPrivateInput("Login email requested by Telegram (Enter to skip if allowed): ", optional: true),
            "email_verification_code" => ReadPrivateInput("Email verification code: "),
            "first_name" or "last_name" => throw new InvalidOperationException("Use an existing Telegram account."),
            _ => null
        };

        // Disable library logs because authentication traffic can contain personal data.
        WTelegram.Helpers.Log = (_, _) => { };

        try
        {
            using var sessionLock = new FileStream(
                Path.Combine(dataDirectory, "login.lock"), FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);
            using var client = new WTelegram.Client(GetConfiguration!);
            await client.LoginUserIfNeeded(reloginOnFailedResume: false);
            Console.WriteLine("Telegram account login completed. Session saved locally. DEMO MODE is active.");
            return 0;
        }
        catch (OperationCanceledException)
        {
            Console.Error.WriteLine("Login cancelled.");
            return 1;
        }
        catch (TL.RpcException)
        {
            Console.Error.WriteLine("Telegram could not complete the login. Check the entered details or try again later.");
            return 1;
        }
        catch (IOException)
        {
            Console.Error.WriteLine("Local session storage is unavailable or another login process is running.");
            return 1;
        }
        catch (Exception)
        {
            Console.Error.WriteLine("Local login could not complete. Verify the credentials and network connection.");
            return 1;
        }
    }

    private static string ReadPrivateInput(string prompt, bool optional = false)
    {
        Console.Write(prompt);
        var answer = new StringBuilder();
        while (true)
        {
            var key = Console.ReadKey(intercept: true);
            if (key.Key == ConsoleKey.Enter)
            {
                Console.WriteLine();
                if (optional || answer.Length > 0) return answer.ToString();
                Console.Write(prompt);
            }
            else if (key.Key == ConsoleKey.Backspace)
            {
                if (answer.Length > 0)
                {
                    answer.Length--;
                    Console.Write("\b \b");
                }
            }
            else if (key.Key == ConsoleKey.Escape)
            {
                throw new OperationCanceledException();
            }
            else if (!char.IsControl(key.KeyChar))
            {
                answer.Append(key.KeyChar);
                Console.Write('*');
            }
        }
    }
}
