# 🤖 MAX Bot Template (PostgreSQL + Webhook)

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![MAX Bot API](https://img.shields.io/badge/MAX-Bot%20API-blue)](https://dev.max.ru/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14%2B-blue)](https://www.postgresql.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Универсальный, готовый к production шаблон для создания ботов в мессенджере **MAX**. 
Включает в себя настройку Webhook, подключение к PostgreSQL, систему сессий и разделение портов для бота и Express (Mini App).

## ✨ Возможности

- 🚀 **Webhook из коробки**: быстрый запуск без Long Polling, готовность к production.
- 🗄️ **PostgreSQL + сессии**: автоматическое сохранение состояний диалогов в БД (`bot_sessions`).
- 🛡️ **Безопасность**: проверка `BOT_WEBHOOK_SECRET`, поддержка российских сертификатов (Минцифры).
- 📦 **Модульная структура**: команды, кнопки и диалоги разделены по папкам.
- 🖥️ **Mini App Ready**: Express-заглушка на отдельном порту для будущего лендинга или Mini App.
- ⚙️ **PM2 + Scaffold**: генератор структуры проектов и конфиг для продакшн-сервера.

## 📋 Требования

- Node.js `v18+` (рекомендуется `v20+`)
- PostgreSQL `14+`
- Nginx (для проксирования HTTPS на Webhook)
- PM2 (`npm install -g pm2`)

## 🚀 Быстрый старт

### 1. Клонирование репозитория

```bash
git clone https://github.com/ваш-аккаунт/ваш-репозиторий.git
cd ваш-репозиторий
```

Или, если используете генератор `scaffold.js`:

```bash
node scaffold.js /путь/к/новому/проекту
cd /путь/к/новому/проекту
```

### 2. Установка зависимостей

```bash
npm install
```

### 3. Настройка окружения

Скопируйте `.env` (он создается автоматически) и заполните данные:

```env
NODE_ENV=production

# Токен бота (получить у @MasterBot в MAX)
BOT_TOKEN=ваш_токен

# Webhook
BOT_WEBHOOK_SECRET=случайная_строка_для_проверки_запросов
DOMAIN=https://ваш-домен.ru
WEBHOOK_PORT=3001

# Express (Mini App)
PORT=3000

# PostgreSQL
PGHOST=localhost
PGPORT=5432
PGUSER=bot_user
PGPASSWORD=ваш_пароль
PGDATABASE=bot_db
```

### 4. Настройка базы данных

Создайте базу и пользователя (подробнее в `SETUP.md`):

```sql
CREATE USER bot_user WITH PASSWORD 'ваш_пароль';
CREATE DATABASE bot_db OWNER bot_user;
```

Примените миграции:

```bash
npm run migrate
```

### 5. Запуск

Для разработки (в терминале):

```bash
npm start
```

Для production (через PM2):

```bash
pm2 start ecosystem.config.cjs
pm2 save
```

### 6. Настройка Nginx (Webhook)

MAX требует HTTPS для вебхуков. Пример конфига:

```nginx
location ^~ /webhook {
    proxy_pass http://127.0.0.1:3002;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}

location / {
    proxy_pass http://127.0.0.1:3003;
    proxy_set_header Host $host;
}
```

## 📁 Структура проекта

```text
.
├── certs/                  # Сертификаты (Минцифры, Let's Encrypt)
├── logs/                   # Логи PM2 (error.log, out.log)
├── migrations/             # SQL-миграции
├── scripts/                # Скрипты (migrate.js)
├── src/
│   ├── index.js            # Точка входа (запуск бота и Express)
│   ├── config.js           # Загрузка .env и проверка переменных
│   ├── db/
│   │   ├── pool.js         # Пул подключений к PostgreSQL
│   │   └── session-store.js# Хранилище сессий в БД
│   ├── bot/
│   │   ├── index.js        # Инициализация бота и Webhook
│   │   ├── commands/       # Обработчики команд (/start, /help)
│   │   ├── actions/        # Обработчики кнопок (callback)
│   │   └── dialogs/        # Пошаговые сценарии (машины состояний)
│   └── mini-app/           # Express-маршруты для Mini App
├── ecosystem.config.cjs    # Конфиг PM2
├── package.json
└── SETUP.md                # Расширенная инструкция по настройке
```

## 🛠 Как добавить новое

**Новая команда:**
1. Создайте файл в `src/bot/commands/` (например, `profile.js`).
2. Экспортируйте функцию `async (ctx) => { ... }`.
3. Добавьте строку в `src/bot/commands/index.js`: `bot.command('profile', profileCommand)`.

**Новая кнопка (callback):**
1. Создайте файл в `src/bot/actions/`.
2. Добавьте обработчик в `src/bot/actions/index.js`: `bot.action('callback_data', handler)`.

**Новая таблица в БД:**
1. Создайте файл в `migrations/` (например, `02_add_users.sql`).
2. Запустите `npm run migrate`.

## 🔒 Безопасность

- Никогда не коммитьте `.env` в Git (он уже в `.gitignore`).
- Используйте `BOT_WEBHOOK_SECRET` для проверки подлинности запросов от MAX.
- Для работы с API MAX на серверах в РФ может потребоваться установка сертификатов Минцифры (см. `SETUP.md`).

## 📄 Лицензия

Этот проект распространяется под лицензией MIT.
