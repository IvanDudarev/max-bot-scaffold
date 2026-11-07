# Настройка проекта (PostgreSQL + webhook)

Пошаговая инструкция: от создания базы до запуска бота.
Предполагается, что `scaffold.js` уже развернул структуру проекта,
и вы находитесь в папке проекта.

---

## 1. Создание базы данных и пользователя PostgreSQL

Войдите в PostgreSQL под администратором:

```bash
sudo -u postgres psql
```

Или, если у вас есть пароль:

```bash
psql -U postgres
```

Внутри `psql` выполните (замените `bot_db`, `bot_user` и пароль на свои):

```sql
-- 1.1. Создать пользователя (роль) с паролем
CREATE USER bot_user WITH PASSWORD 'ВашНадежныйПароль123!';

-- 1.2. Создать базу данных, принадлежащую этому пользователю
CREATE DATABASE bot_db OWNER bot_user;

-- 1.3. Выдать все права на базу
GRANT ALL PRIVILEGES ON DATABASE bot_db TO bot_user;

-- 1.4. Выйти
\q
```

> ⚠️ Наличие других баз на сервере не мешает: `bot_user` получает права
> только на `bot_db`.

> 💡 Если при миграции получите `permission denied for schema public`,
> выполните в `psql`:
> ```sql
> \c bot_db
> GRANT ALL ON SCHEMA public TO bot_user;
> ```

---

## 2. Заполнение `.env`

Откройте `.env` в корне проекта и заполните:

```env
# Окружение
NODE_ENV=development

# Токен бота (получить у @MasterBot в MAX)
BOT_TOKEN=ваш_токен

# Webhook (обязательно для production)
BOT_WEBHOOK_SECRET=случайная_строка
DOMAIN=https://bot.example.com
PORT=3000

# PostgreSQL
PGHOST=localhost
PGPORT=5432
PGUSER=bot_user
PGPASSWORD=ВашНадежныйПароль123!
PGDATABASE=bot_db
```

**Пояснения:**

- `BOT_WEBHOOK_SECRET` — секретная строка, которую MAX присылает в заголовке
  для проверки, что запрос действительно от MAX. Придумайте случайную строку
  (например, `openssl rand -hex 32`).
- `DOMAIN` — публичный HTTPS-адрес бота (без пути). Например,
  `https://bot.example.com`. Именно сюда MAX будет отправлять обновления.
- `PORT` — порт Express-заглушки (Mini App, health-check). Webhook слушает
  **свой порт** (`3001`), он задан в `src/config.js` (`bot.webhookPort`).

> Если `BOT_TOKEN`, `BOT_WEBHOOK_SECRET` или `DOMAIN` пустые — `src/config.js`
> упадёт с понятной ошибкой при запуске.

---

## 3. Установка зависимостей

```bash
npm install
```

Установятся: `@maxhub/max-bot-api`, `pg`, `dotenv`, `express`.

---

## 4. Применение миграций

```bash
node scripts/migrate.js
```

Скрипт:
- Подключается к PostgreSQL (через `PG*` из `.env`).
- Создаёт служебную таблицу `_migrations`.
- Читает `migrations/*.sql` по алфавиту.
- Применяет только новые.
- Записывает факт применения в `_migrations`.

После первого запуска появятся:
- таблица `bot_sessions` (для сессий);
- индекс по `updated_at`;
- триггер, который обновляет `updated_at` при каждом `UPDATE`.

---

## 5. Заполнение БД начальными данными (опционально)

```bash
node seeds/seed.js
```

Сейчас `seeds/seed.js` — заглушка. Если нужны начальные данные (тарифы,
справочники, лимиты) — добавьте логику туда.

---

## 6. HTTPS для webhook

MAX требует HTTPS. Бот запускает webhook-сервер на порту `3001`
(внутренний), а снаружи должен быть HTTPS-прокси.

**Вариант А: Nginx + Let's Encrypt (рекомендуется)**

```nginx
server {
  listen 443 ssl;
  server_name bot.example.com;

  ssl_certificate     /etc/letsencrypt/live/bot.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/bot.example.com/privkey.pem;

  # Webhook бота (порт 3001)
  location /webhook {
    proxy_pass http://127.0.0.1:3001/webhook;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }

  # Mini App / health-check (порт 3000)
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

**Вариант Б: Caddy**

```
bot.example.com {
  reverse_proxy /webhook 127.0.0.1:3001
  reverse_proxy 127.0.0.1:3000
}
```

---

## 7. Запуск бота

### Вариант А: для разработки (в терминале)

```bash
npm start
```

Вы увидите:
```
🚀 Запуск (development)
✅ PostgreSQL подключён
[Bot] Webhook: https://bot.example.com/webhook (port 3001)
[Express] http://127.0.0.1:3000 (заглушка под Mini App)
```

Остановить — `Ctrl+C`.

### Вариант Б: production (в фоне через PM2)

```bash
pm2 start ecosystem.config.cjs
```

PM2 запустит бота в фоне, будет перезапускать при падении и писать логи
в `logs/out.log` и `logs/error.log`.

Проверить статус:

```bash
pm2 status
```

Смотреть логи:

```bash
pm2 logs <имя_проекта>
```

> Имя проекта = имя папки, куда развернули `scaffold.js`.

---

## 8. Проверка работы

В MAX найдите своего бота и отправьте:

```
/start
```

Бот должен ответить: `Hello World 👋`

```
/help
```

Бот должен показать список команд.

Если ответа нет — см. раздел 10.

---

## 9. Полезные команды PM2

```bash
pm2 start ecosystem.config.cjs                # запустить
pm2 restart ecosystem.config.cjs --update-env # перезапустить с обновлением env
pm2 stop <имя_проекта>                        # остановить
pm2 delete <имя_проекта>                      # удалить из PM2
pm2 logs <имя_проекта>                        # смотреть логи
pm2 status                                    # статус всех процессов
```

---

## 10. Если что-то пошло не так

**`Missing required env variables: BOT_TOKEN, BOT_WEBHOOK_SECRET, DOMAIN`** —
заполните `.env` (шаг 2).

**`Ошибка подключения к PostgreSQL`** — проверьте `PG*` в `.env`,
убедитесь, что PostgreSQL запущен (`sudo systemctl status postgresql`),
и что пользователь `bot_user` существует (шаг 1).

**`password authentication failed for user "bot_user"`** — неверный пароль.
Пересоздайте пользователя (шаг 1.1) или проверьте `.env`.

**`database "bot_db" does not exist`** — база не создана. Выполните шаг 1.2.

**`relation "bot_sessions" does not exist`** — не применены миграции.
Запустите `node scripts/migrate.js` (шаг 4).

**`permission denied for schema public`** — пользователь не владелец базы.
Выполните `GRANT ALL ON SCHEMA public TO bot_user;` в `psql` (шаг 1).

**`Cannot find module 'pg'`** — не выполнен `npm install` (шаг 3).

**Бот не отвечает на `/start`** — проверьте:
- `pm2 logs <имя_проекта>` (ошибки).
- Что `DOMAIN` доступен извне (`curl https://bot.example.com/webhook`).
- Что Nginx/Caddy проксирует `/webhook` на порт `3001`.
- Что `BOT_WEBHOOK_SECRET` в `.env` совпадает с тем, что MAX присылает
  (если секрет неверный, MAX может отклонять запросы).

**`Webhook registration failed`** — `DOMAIN` недоступен извне или
не HTTPS. Проверьте, что `https://bot.example.com/webhook` открывается
(даже если отвечает 404 — главное, что HTTPS работает).

---

## 11. Что дальше

- **Новая команда** → `src/bot/commands/` + строка в `commands/index.js`.
- **Новая кнопка** → `src/bot/actions/` + строка в `actions/index.js`.
- **Новый диалог** → `src/bot/dialogs/` + вызов в `dialogs/index.js`.
- **Новая таблица** → новый `.sql` в `migrations/` + `node scripts/migrate.js`.
- **Запросы к БД** → `src/db/queries.js` (или прямо в обработчиках, если просто).
- **Mini App** → `src/mini-app/routes.js` (монтируется на `/mini`).

Структура сделана так, чтобы `src/index.js` не менялся при добавлении
команд, кнопок и диалогов.
