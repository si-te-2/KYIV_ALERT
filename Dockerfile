FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY Directory.Build.props ./
COPY backend/ ./backend/
RUN dotnet publish backend/KyivAlert.Api/KyivAlert.Api.csproj -c Release -o /out /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /out/ ./
USER app
ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080
# --urls overrides the local-only default from appsettings.json.
ENTRYPOINT ["/bin/sh", "-c", "exec dotnet KyivAlert.Api.dll --urls http://0.0.0.0:${PORT:-8080}"]
