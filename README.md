# KYIV ALERT

Локальна DEMO-панель для майбутньої системи аналізу повідомлень про загрози для Києва.

## Поточна версія

Етап 1 завершено мінімальною робочою версією. ASP.NET Core API повертає стан системи та синтетичне повідомлення. React-панель показує DEMO MODE, зупинений моніторинг, стан Telegram, джерела й історію. При втраті API вона показує втрату з’єднання та позначає попередні дані.

Моніторинг має статус STOPPED, Telegram — NOT_CONFIGURED. Увімкнення `DemoMode=false` зупиняє запуск із помилкою. База даних, бот, аналізатор, SignalR, авторизація адміністратора, звук, PWA та Web Push заплановані наступними етапами. У цій версії API лише читає локальні DEMO-дані.

## Запуск

Потрібні .NET SDK 10, Node.js 22.12+ або 24 LTS для frontend-збірки та PowerShell 7. Виконайте з кореня репозиторію.

```powershell
./scripts/build.ps1
dotnet run --project backend/KyivAlert.Api
```

Відкрийте [локальну панель](http://127.0.0.1:5080). ASP.NET Core обслуговує результат Vite-збірки. Сервер слухає 127.0.0.1. Після змін frontend повторіть build. Для завершення натисніть Ctrl+C.

Ручні команди для Linux/macOS наведені в [інструкції](docs/local-development.md).

## Радар і джерела

Головне меню відкриває огляд, [радар](http://127.0.0.1:5080/#/radar), налаштування карти та «Що нового». На радарі можна збільшити карту, перейти до Києва та вибрати один із 27 регіонів. Позначки тривог є навчальними. Налаштування зберігаються в браузері. [Географічні дані й авторство](docs/map-data.md)

Кнопка «Запустити тест» підсвічує Київ, Київську і Чернігівську області та показує сповіщення на сторінці. Кнопка «Завершити тест» показує навчальний відбій. Поточний стан повітряних тривог доступний на [офіційній мапі](https://map.ukrainealarm.com/).

Сім каналів Telegram додано до переліку джерел зі статусом «Очікує доступу». [Доступ і список каналів](docs/telegram-sources.md)

## Перевірки

```sh
dotnet build backend/KyivAlert.Api/KyivAlert.Api.csproj --configuration Release
dotnet test backend/KyivAlert.Tests/KyivAlert.Tests.csproj --configuration Release
npm --prefix frontend ci
npm --prefix frontend run build
npm --prefix frontend test
```

GitHub Actions виконує збірку, тести й HTTP-перевірку зібраної панелі. Локально перевірено збірки C# та React, 4 xUnit і 2 frontend-тести.

## Структура

```text
backend/
  KyivAlert.Api/             ASP.NET Core, read-only DEMO API
  KyivAlert.Core/            Контракти стану системи
  KyivAlert.Infrastructure/  DEMO-провайдер даних
  KyivAlert.Telegram/        Проєкт майбутнього Telegram-модуля
  KyivAlert.Tests/           Інтеграційні xUnit-тести API
frontend/src/
  components/ pages/ hooks/ services/ styles/ assets/
docs/
scripts/
.github/workflows/
```

## Конфігурація

.env.example містить порожні шаблони для наступних етапів. ASP.NET Core читає змінні середовища. Файли .env автоматично не завантажуються. Токени, паролі, Telegram session-файли та ключі зберігайте локально. .gitignore виключає типові секретні файли й результати збірки.

[План розробки](docs/roadmap.md) визначає наступні етапи.

Ліцензія очікує погодження власника.
