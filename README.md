# Анонимные сообщения — Telegram Mini App

Статический интерфейс опубликован через GitHub Pages. Сервер и бот должны работать отдельно на Railway, потому что GitHub Pages не принимает сообщения и не хранит секреты.

## Переменные Railway

- `BOT_TOKEN` — токен бота из BotFather (секретный; не публиковать в коде).
- `BOT_USERNAME` — имя бота без символа @.
- `DATABASE_URL` — PostgreSQL connection string.
- `WEBHOOK_SECRET` — случайная строка из букв/цифр/дефиса/подчёркивания.
- `APP_URL` — `https://a34147488-max.github.io/Bot/`
- `RAILWAY_PUBLIC_DOMAIN` — Railway обычно предоставляет автоматически.

Добавьте PostgreSQL в Railway и подключите его переменную `DATABASE_URL`. Запустите сервис из корня репозитория. Сервер автоматически создаёт таблицы и регистрирует Telegram webhook, если заданы `BOT_TOKEN` и `RAILWAY_PUBLIC_DOMAIN`.

## Важное ограничение текущего этапа

Фронтенд GitHub Pages не может сам определить пользователя Telegram вне Telegram Mini App. Открывать приложение нужно кнопкой Web App у бота. После деплоя задайте URL Mini App в BotFather (или используйте кнопку, которую бот выдаёт по /start) и в настройках Telegram включите Main Mini App при необходимости.

Никогда не сохраняйте BOT_TOKEN в `index.html` или в публичном репозитории.
