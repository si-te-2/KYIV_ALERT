# Telegram

Модуль містить окрему консольну команду локального входу через MTProto на власному акаунті.

```sh
dotnet run --project backend/KyivAlert.Telegram -- --check-config
dotnet run --project backend/KyivAlert.Telegram -- --login
```

Реквізити застосунку зберігаються у локальному .NET User Secrets із ID kyiv-alert-telegram-local. Ключі Telegram:ApiId та Telegram:ApiHash можна також передати через змінні середовища KYIVALERT_Telegram__ApiId та KYIVALERT_Telegram__ApiHash. User Secrets використовує файли профілю користувача поза репозиторієм. Це сховище для розробки з доступом поточного користувача.

При --login номер, код і пароль вводяться у локальному терміналі з прихованим введенням. Сесія зберігається в каталозі LocalApplicationData/KyivAlert/Telegram. На Windows це %LOCALAPPDATA%/KyivAlert/Telegram. Файл сесії зашифровано бібліотекою WTelegramClient із використанням api_hash. Паралельний процес входу блокується.

Авторизацію підтверджує власник акаунта. Створюється повноцінна сесія Telegram-клієнта, яку можна завершити у Telegram через Налаштування → Пристрої. Після входу команда завершується, а сайт продовжує працювати в DEMO MODE. Статус NOT_CONFIGURED на панелі стосується Telegram-бота.

Команди /start, /status, /test, /sources, /help та Telegram.Bot заплановані на наступному етапі.

[WTelegramClient](https://github.com/wiz0u/WTelegramClient) · [Авторизація Telegram](https://core.telegram.org/api/auth)
