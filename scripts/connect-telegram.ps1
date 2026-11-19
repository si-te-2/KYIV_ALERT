$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path $PSScriptRoot -Parent
$dotnetCommand = Get-Command dotnet -ErrorAction SilentlyContinue
if (-not $dotnetCommand) {
    throw 'Install .NET SDK 10 and open a new PowerShell terminal.'
}
dotnet run --project (Join-Path $repositoryRoot 'backend/KyivAlert.Telegram') -- --login
if ($LASTEXITCODE -ne 0) { throw 'Telegram login did not complete.' }
