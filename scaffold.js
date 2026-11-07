#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);
const targetArg = args.find((a) => !a.startsWith('--'));
const force = args.includes('--force');

if (!targetArg) {
  console.error('❌ Укажите путь: node scaffold.js /путь/к/проекту [--force]');
  process.exit(1);
}

const ROOT = path.resolve(targetArg);
const PROJECT_NAME = path.basename(ROOT);
const SCRIPT_DIR = __dirname;
const SOURCE_CERTS = path.join(SCRIPT_DIR, 'certs');
const SOURCE_SETUP = path.join(SCRIPT_DIR, 'SETUP.md');

const DIRS = [
  'certs',
  'logs',
  'migrations',
  'seeds',
  'scripts',
  'src',
  'src/db',
  'src/bot',
  'src/bot/commands',
  'src/bot/actions',
  'src/bot/dialogs',
  'src/mini-app',
  'src/services',
  'src/utils',
];

const FILES = {
  '.gitignore': `node_modules/
.env
*.log
certs/*.cer
certs/*.crt
`,

  'logs/error.log': '',
  'logs/out.log': '',

  '.env': `# Окружение
NODE_ENV=development

# Токен бота
BOT_TOKEN=

# Webhook
BOT_WEBHOOK_SECRET=
DOMAIN=
WEBHOOK_PORT=3002

# Express (Mini App / health-check)
PORT=3003

# PostgreSQL
PGHOST=localhost
PGPORT=5432
PGUSER=bot_user
PGPASSWORD=
PGDATABASE=bot_db
`,

  'package.json': JSON.stringify(
    {
      name: PROJECT_NAME,
      version: '0.1.0',
      description: 'Шаблон проекта для бота (PostgreSQL + webhook)',
      type: 'module',
      main: 'src/index.js',
      scripts: {
        start: 'node src/index.js',
        migrate: 'node scripts/migrate.js',
        seed: 'node seeds/seed.js',
      },
      dependencies: {
        '@maxhub/max-bot-api': 'latest',
        pg: 'latest',
        dotenv: 'latest',
        express: 'latest',
      },
    },
    null,
    2
  ) + '\n',

  'ecosystem.config.cjs': `module.exports = {
  apps: [
    {
      name: '${PROJECT_NAME}',
      script: 'src/index.js',
      cwd: __dirname,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      max_memory_restart: '300M',
      env: {
        NODE_EXTRA_CA_CERTS: __dirname + '/certs/bundle.crt',
      },
      error_file: 'logs/error.log',
      out_file: 'logs/out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
`,

  'README.md': `# ${PROJECT_NAME}

Шаблон проекта для бота (PostgreSQL + webhook).

## Структура

\`\`\`text
${PROJECT_NAME}/
├── certs/
│   ├── bundle.crt
│   ├── Russian_Trusted_Root_CA.cer
│   ├── Russian_Trusted_Sub_CA.cer
│   └── Russian_Trusted_Sub_CA_2024.cer
├── logs/
│   ├── error.log
│   └── out.log
├── migrations/
│   └── 01_create_sessions.sql
├── seeds/
│   └── seed.js
├── scripts/
│   └── migrate.js
├── src/
│   ├── index.js
│   ├── config.js
│   ├── db/
│   │   ├── pool.js
│   │   └── session-store.js
│   ├── bot/
│   │   ├── index.js
│   │   ├── commands/
│   │   │   ├── index.js
│   │   │   ├── start.js
│   │   │   └── help.js
│   │   ├── actions/
│   │   │   ├── index.js
│   │   │   └── example.js
│   │   └── dialogs/
│   │       ├── index.js
│   │       └── example.js
│   ├── mini-app/
│   │   └── routes.js
│   ├── services/
│   └── utils/
├── .env
├── .gitignore
├── ecosystem.config.cjs
├── package.json
├── SETUP.md
└── README.md
\`\`\`

## Запуск

См. \`SETUP.md\`.
`,

  'migrations/01_create_sessions.sql': `CREATE TABLE IF NOT EXISTS bot_sessions (
  session_key VARCHAR(255) NOT NULL,
  session_data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (session_key)
);

CREATE INDEX IF NOT EXISTS idx_bot_sessions_updated_at
  ON bot_sessions (updated_at);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bot_sessions_updated_at ON bot_sessions;
CREATE TRIGGER trg_bot_sessions_updated_at
  BEFORE UPDATE ON bot_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
`,

  'seeds/seed.js': `// seeds/seed.js
// Заглушка: здесь будет логика заполнения БД начальными данными.
`,

  'scripts/migrate.js': `// scripts/migrate.js
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

async function main() {
  const client = new Client();
  await client.connect();

  await client.query(\`
    CREATE TABLE IF NOT EXISTS _migrations (
      name VARCHAR(255) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (name)
    );
  \`);

  const { rows } = await client.query('SELECT name FROM _migrations');
  const applied = new Set(rows.map((r) => r.name));

  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    if (applied.has(file)) {
      console.log(\`⏭  уже применена: \${file}\`);
      continue;
    }
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    console.log(\`📄 применяю: \${file}\`);
    await client.query(sql);
    await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
    console.log(\`✅ применена: \${file}\`);
  }

  await client.end();
  console.log('\\n✅ Миграции завершены');
}

main().catch((err) => {
  console.error('❌ Ошибка миграций:', err);
  process.exit(1);
});
`,

  'src/config.js': `// src/config.js
import 'dotenv/config';

const required = ['BOT_TOKEN', 'BOT_WEBHOOK_SECRET', 'DOMAIN', 'WEBHOOK_PORT'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error('❌ Missing required env variables:', missing.join(', '));
  process.exit(1);
}

const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3003,
  domain: process.env.DOMAIN,

  bot: {
    token: process.env.BOT_TOKEN,
    secret: process.env.BOT_WEBHOOK_SECRET,
    webhookPort: Number(process.env.WEBHOOK_PORT),
    webhookPath: '/webhook',
  },

  db: {
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT) || 5432,
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || '',
    name: process.env.PGDATABASE || 'bot',
  },
};

// Защита от конфликта портов
if (config.port === config.bot.webhookPort) {
  console.error(
    \`❌ PORT (\${config.port}) и WEBHOOK_PORT (\${config.bot.webhookPort}) совпадают. Разведите их в .env.\`
  );
  process.exit(1);
}

export default config;
`,

  'src/db/pool.js': `// src/db/pool.js
import pg from 'pg';
import config from '../config.js';

const { Pool } = pg;

const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.name,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export async function query(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows;
}

export default pool;
`,

  'src/db/session-store.js': `// src/db/session-store.js
import pool from './pool.js';

export class PostgresSessionStore {
  async get(key) {
    const { rows } = await pool.query(
      'SELECT session_data FROM bot_sessions WHERE session_key = $1',
      [key]
    );
    return rows.length > 0 ? rows[0].session_data : undefined;
  }

  async set(key, value) {
    await pool.query(
      \`INSERT INTO bot_sessions (session_key, session_data)
       VALUES ($1, $2)
       ON CONFLICT (session_key) DO UPDATE SET session_data = EXCLUDED.session_data\`,
      [key, JSON.stringify(value)]
    );
  }

  async delete(key) {
    await pool.query('DELETE FROM bot_sessions WHERE session_key = $1', [key]);
  }
}

export const sessionStore = new PostgresSessionStore();
`,

  'src/bot/index.js': `// src/bot/index.js
import { Bot, session } from '@maxhub/max-bot-api';
import config from '../config.js';
import { sessionStore } from '../db/session-store.js';
import { registerCommands } from './commands/index.js';
import { registerActions } from './actions/index.js';
import { registerDialogs } from './dialogs/index.js';

let bot = null;

export async function startBot() {
  bot = new Bot(config.bot.token);

  // Сессии — в PostgreSQL
  bot.use(session({ store: sessionStore }));

  // Регистрация обработчиков
  registerCommands(bot);
  registerActions(bot);
  registerDialogs(bot);

  // Подсказки команд в интерфейсе MAX
  await bot.api.setMyCommands([
    { name: 'start', description: 'Запустить бота' },
    { name: 'help', description: 'Справка' },
  ]);
  
  // Обработка нажатия кнопки "Начать" при первом запуске
  bot.on('bot_started', async (ctx) => {
    await ctx.reply('Добро пожаловать! 👋\nЯ готов к работе. Напишите /help, чтобы узнать, что я умею.');
  });

  // Запуск webhook
  await bot.start({
    mode: 'webhook',
    options: {
      domain: config.domain,
      port: config.bot.webhookPort,
      path: config.bot.webhookPath,
      secret: config.bot.secret,
      allowedUpdates: ['message_created', 'bot_started', 'message_callback'],
    },
  });

  console.log(
    \`[Bot] Webhook: \${config.domain}\${config.bot.webhookPath} (port \${config.bot.webhookPort})\`
  );

  return bot;
}

export function getBot() {
  return bot;
}
`,

  'src/bot/commands/index.js': `// src/bot/commands/index.js
import { startCommand } from './start.js';
import { helpCommand } from './help.js';

export function registerCommands(bot) {
  bot.command('start', startCommand);
  bot.command('help', helpCommand);
}
`,

  'src/bot/commands/start.js': `// src/bot/commands/start.js
export async function startCommand(ctx) {
  await ctx.reply('Hello World 👋');
}
`,

  'src/bot/commands/help.js': `// src/bot/commands/help.js
export async function helpCommand(ctx) {
  await ctx.reply(
    'Доступные команды:\\n' +
      '/start — приветствие\\n' +
      '/help — эта справка'
  );
}
`,

  'src/bot/actions/index.js': `// src/bot/actions/index.js
import { exampleAction } from './example.js';

export function registerActions(bot) {
  bot.action('example', exampleAction);
}
`,

  'src/bot/actions/example.js': `// src/bot/actions/example.js
export async function exampleAction(ctx) {
  await ctx.answerOnCallback({ notification: 'Кнопка нажата' });
}
`,

  'src/bot/dialogs/index.js': `// src/bot/dialogs/index.js
import { registerExampleDialog } from './example.js';

export function registerDialogs(bot) {
  registerExampleDialog(bot);
}
`,

  'src/bot/dialogs/example.js': `// src/bot/dialogs/example.js
export function registerExampleDialog(bot) {
  bot.command('example', async (ctx) => {
    await ctx.reply('Как вас зовут?');
  });
}
`,

  'src/mini-app/routes.js': `// src/mini-app/routes.js
import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => {
  res.send('Mini App (заглушка).');
});

export default router;
`,

  'src/index.js': `// src/index.js
import express from 'express';
import config from './config.js';
import pool from './db/pool.js';
import { startBot } from './bot/index.js';
import miniAppRoutes from './mini-app/routes.js';

async function main() {
  console.log(\`🚀 Запуск (\${config.nodeEnv})\`);

  try {
    await pool.query('SELECT 1');
    console.log('✅ PostgreSQL подключён');
  } catch (err) {
    console.error('❌ Ошибка подключения к PostgreSQL:', err.message);
    process.exit(1);
  }

  const bot = await startBot();

  const app = express();
  app.use(express.json());

  app.get('/health', async (req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ok', db: 'ok' });
    } catch (err) {
      res.status(503).json({ status: 'error', db: err.message });
    }
  });

  app.use('/mini', miniAppRoutes);
  app.use((req, res) => res.status(404).send('Not Found'));

  const server = app.listen(config.port, '127.0.0.1', () => {
    console.log(\`[Express] http://127.0.0.1:\${config.port} (заглушка под Mini App)\`);
  });

  const shutdown = async (signal) => {
    console.log(\`\\n\${signal} получен, останавливаем...\`);
    try { await bot.stop(); } catch (err) { console.error(err.message); }
    server.close();
    await pool.end();
    console.log('✅ Остановлено');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('❌ Фатальная ошибка:', err);
  process.exit(1);
});
`,
};

// Создание папок
for (const dir of DIRS) {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) {
    fs.mkdirSync(full, { recursive: true });
    console.log(`📁 создана папка: ${dir}`);
  } else {
    console.log(`⏭  папка уже есть: ${dir}`);
  }
}

// Создание файлов
for (const [rel, content] of Object.entries(FILES)) {
  const full = path.join(ROOT, rel);
  const dir = path.dirname(full);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  if (fs.existsSync(full) && !force) {
    console.log(`⏭  файл уже есть: ${rel}`);
    continue;
  }

  fs.writeFileSync(full, content, 'utf8');
  console.log(`📄 создан файл: ${rel}`);
}

// Копирование сертификатов
if (fs.existsSync(SOURCE_CERTS) && fs.statSync(SOURCE_CERTS).isDirectory()) {
  const targetCerts = path.join(ROOT, 'certs');
  if (!fs.existsSync(targetCerts)) fs.mkdirSync(targetCerts, { recursive: true });

  for (const entry of fs.readdirSync(SOURCE_CERTS)) {
    const src = path.join(SOURCE_CERTS, entry);
    const dest = path.join(targetCerts, entry);

    if (fs.statSync(src).isDirectory()) {
      fs.cpSync(src, dest, { recursive: true, force });
    } else {
      if (fs.existsSync(dest) && !force) {
        console.log(`⏭  сертификат уже есть: certs/${entry}`);
        continue;
      }
      fs.copyFileSync(src, dest);
    }
    console.log(`📎 скопирован сертификат: certs/${entry}`);
  }
}

// Копирование SETUP.md
if (fs.existsSync(SOURCE_SETUP)) {
  const destSetup = path.join(ROOT, 'SETUP.md');
  if (fs.existsSync(destSetup) && !force) {
    console.log(`⏭  файл уже есть: SETUP.md`);
  } else {
    fs.copyFileSync(SOURCE_SETUP, destSetup);
    console.log(`📎 скопирован: SETUP.md`);
  }
}

console.log(`\n✅ Готово: ${ROOT}`);
console.log(`   Имя проекта: ${PROJECT_NAME}`);
