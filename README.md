# 🚚 Delivery Tracker

Telegram Mini App для трекинга доставок с фабрики на филиалы.
Деплой на Vercel — один проект, одна команда `vercel deploy`.
База: **Supabase** (Postgres + Data API).

## Филиалы

| # | Название | Адрес | Управляющий | Координаты |
|---|----------|-------|-------------|------------|
| 1 | C1 Dark | Буюк Ипак Йули 36 | @B_o_b_rakh_tigermma | 41.310862, 69.288302 |
| 2 | Ecopark Cafe | Узбекистон Овози 28 | @zubayrmma | 41.311676, 69.292960 |
| 3 | Shevchenko Cafe | Шевченко 21А | @sob1rov_f1 | 41.297168, 69.281061 |
| 4 | Boulevard Cafe | Укчи 6 | @Ibn_Abdulloh | 41.316910, 69.245351 |
| 5 | SeoulMun Cafe | Баходыра 69/1 | @I_A_R_10 | 41.298851, 69.246487 |
| 6 | Beruni Cafe | Беруни 41 | @shislam_099 | 41.344840, 69.204587 |

🏭 **Фабрика:** 1-й проезд Мукими 23а · @nicknet97 · 41.277943, 69.246124

🚚 **Развозчик:** +998935664333

## Флоу

```
📦 Развозчик → «Забрал с фабрики» → проверка геолокации → @nicknet97 подтверждает ✅/❌
🚚 Развозчик → Выбирает филиал → «Подтвердить доставку» → управляющий филиала подтверждает ✅/❌
📢 После подтверждения → статус уходит в группу
```

## Структура

```
pasta-pasta-tracker/
├── app/
│   ├── page.js                    # Mini App (фронтенд)
│   ├── layout.js
│   ├── globals.css
│   └── api/                       # Next.js API routes
├── lib/
│   ├── bot.js                     # Логика бота (webhook mode)
│   ├── db.js                      # Supabase client + SQL adapter
│   ├── branches.js                # Филиалы + фабрика + водитель
│   └── geo.js                     # Haversine
├── supabase/
│   ├── schema.sql                 # DDL — применить в SQL Editor
│   └── README.md
├── next.config.js
├── jsconfig.json
├── vercel.json
└── package.json
```

## Supabase (обязательно один раз)

Publishable/anon ключ **не умеет** создавать таблицы. Примени схему вручную:

1. Открой [SQL Editor](https://supabase.com/dashboard/project/efrvxxtfkqezgvumvzjw/sql/new)
2. Вставь содержимое [`supabase/schema.sql`](./supabase/schema.sql)
3. Нажми **Run**

Создаются таблицы: `deliveries`, `managers`, `user_access` + RLS-политики для Data API.

Project: `efrvxxtfkqezgvumvzjw`  
URL: `https://efrvxxtfkqezgvumvzjw.supabase.co`

## Деплой на Vercel

### 1. Переменные окружения в Vercel

```
BOT_TOKEN=123456:ABC...
WEBHOOK_SECRET=random-string
GROUP_CHAT_ID=-100xxxx
MAX_DISTANCE_METERS=300
SUPABASE_URL=https://efrvxxtfkqezgvumvzjw.supabase.co
SUPABASE_KEY=sb_publishable_...   # или classic anon key
```

### 2. Деплой

```bash
npm i -g vercel
vercel
# Или подключи репо в Vercel Dashboard
```

### 3. Установи webhook

После деплоя открой в браузере:
```
https://your-app.vercel.app/api/webhook?setup=1
```

### 4. Регистрация управляющих

Каждый управляющий должен **один раз** открыть бота и нажать `/start` — бот автоматически привяжет его к филиалу по username.

## Локальная разработка

```bash
cp .env.example .env.local
# заполни SUPABASE_URL / SUPABASE_KEY (+ BOT_TOKEN при необходимости)
npm install
npm run dev
```

## Команды бота

- `/start` — открыть Mini App + регистрация управляющего
- `/stats` — статистика за сегодня
