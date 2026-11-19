# Локальна розробка

Встановіть .NET SDK 10 та Node.js 22.12+ або 24 LTS. Перевірте dotnet --version та node --version.

## Windows

Відкрийте PowerShell 7 у корені репозиторію.

```powershell
./scripts/build.ps1
dotnet run --project backend/KyivAlert.Api
```

Відкрийте http://127.0.0.1:5080. API доступне за /api/status і /api/health.

## Linux та macOS

```sh
npm --prefix frontend ci
npm --prefix frontend run build
npm --prefix frontend test
dotnet build backend/KyivAlert.Api/KyivAlert.Api.csproj -c Release
dotnet test backend/KyivAlert.Tests/KyivAlert.Tests.csproj -c Release
mkdir -p backend/KyivAlert.Api/wwwroot
cp -R frontend/dist/. backend/KyivAlert.Api/wwwroot/
dotnet run --project backend/KyivAlert.Api
```

Після зміни React повторіть build і копіювання dist. HTTP-сервер застосунку працює на C#. Node.js використовується для встановлення залежностей, компіляції й frontend-тестів.

## DEMO-поведінка

При запуску створюється одне синтетичне повідомлення. Його ID і час залишаються сталими протягом життя процесу. checkedAt оновлюється з кожною відповіддю. Панель опитує API кожні 10 секунд. Після таймауту або HTTP-помилки показує втрату з’єднання. Після відновлення автоматично отримує відповідь. Остання відповідь зберігається у пам’яті відкритої сторінки. Збереження між перезапусками браузера буде додане на етапі PWA.

DemoMode=false спричиняє відмову запуску. Походження синтетичного повідомлення позначено як локальну DEMO-подію.

## Усунення проблем

- Якщо сторінка недоступна, перевірте вивід dotnet run і зайнятість порту 5080.
- Якщо API відповідає, але сторінка відсутня, повторіть build та копіювання dist у wwwroot.
- Якщо панель показує втрату з’єднання, перевірте /api/health. Після відновлення API панель повторить запит.
- Якщо політика Windows обмежує запис у Documents, використайте дозволений каталог розробки. Проміжні файли .NET можна вивести через --artifacts-path.
