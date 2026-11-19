$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path $PSScriptRoot -Parent
$npmCommand = if ($IsWindows) { 'npm.cmd' } else { 'npm' }
Push-Location $repositoryRoot
try {
    & $npmCommand --prefix frontend ci
    if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed.' }
    & $npmCommand --prefix frontend run build
    if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
    & $npmCommand --prefix frontend test
    if ($LASTEXITCODE -ne 0) { throw 'Frontend tests failed.' }
    dotnet build backend/KyivAlert.Api/KyivAlert.Api.csproj --configuration Release
    if ($LASTEXITCODE -ne 0) { throw 'Backend build failed.' }
    dotnet test backend/KyivAlert.Tests/KyivAlert.Tests.csproj --configuration Release
    if ($LASTEXITCODE -ne 0) { throw 'Backend tests failed.' }
    $webRoot = Join-Path $repositoryRoot 'backend/KyivAlert.Api/wwwroot'
    New-Item -ItemType Directory -Force -Path $webRoot | Out-Null
    Copy-Item -Path frontend/dist/* -Destination $webRoot -Recurse -Force
} finally {
    Pop-Location
}
