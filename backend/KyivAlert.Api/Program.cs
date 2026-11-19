using KyivAlert.Core;
using KyivAlert.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

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
app.Run();

public partial class Program;
