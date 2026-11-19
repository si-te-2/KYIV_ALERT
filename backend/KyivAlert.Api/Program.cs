using KyivAlert.Core;
using KyivAlert.Infrastructure;
using KyivAlert.Telegram;

var builder = WebApplication.CreateBuilder(args);

if (builder.Configuration.GetValue("CivilAlerts:Enabled", false))
{
    builder.Configuration.AddUserSecrets("kyiv-alert-telegram-local")
        .AddEnvironmentVariables("KYIVALERT_");
}

builder.Services.AddSingleton<CivilAlertsMonitor>();
builder.Services.AddHostedService(services => services.GetRequiredService<CivilAlertsMonitor>());
builder.Services.AddProblemDetails();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<ISystemSnapshotProvider, DemoSnapshotProvider>();

var app = builder.Build();
if (!app.Configuration.GetValue("DemoMode", true))
{
    throw new InvalidOperationException("This development version requires DemoMode=true.");
}

app.UseExceptionHandler();
app.Use(async (context, next) =>
{
    context.Response.Headers.CacheControl = "no-store";
    context.Response.Headers.XContentTypeOptions = "nosniff";
    context.Response.Headers["Referrer-Policy"] = "no-referrer";
    await next(context);
});
app.UseDefaultFiles();
app.UseStaticFiles();
app.MapGet("/api/health", () => Results.Ok(new { status = "ok", demoMode = true }));
app.MapGet("/api/status", (ISystemSnapshotProvider provider) => provider.GetSnapshot());
app.MapGet("/api/civil-alerts", (CivilAlertsMonitor monitor) => monitor.GetSnapshot());
app.Run();

public partial class Program;
