# Supabase setup

Project ID: `efrvxxtfkqezgvumvzjw`  
URL: `https://efrvxxtfkqezgvumvzjw.supabase.co`

## 1. Create tables (required, one-time)

The publishable/anon key **cannot** run DDL. Apply the schema manually:

1. Open [SQL Editor](https://supabase.com/dashboard/project/efrvxxtfkqezgvumvzjw/sql/new)
2. Paste the contents of [`schema.sql`](./schema.sql)
3. Click **Run**

This creates:

| Table | Purpose |
|-------|---------|
| `deliveries` | Pickup / delivery events |
| `managers` | Telegram managers linked to branches |
| `user_access` | Dynamic roles (director grants) |

…and enables RLS policies so the publishable key can read/write.

## 2. Environment variables (Vercel / local)

```env
SUPABASE_URL=https://efrvxxtfkqezgvumvzjw.supabase.co
SUPABASE_KEY=<your publishable or anon key>
```

Also keep existing bot vars: `BOT_TOKEN`, `GROUP_CHAT_ID`, `MAX_DISTANCE_METERS`, etc.

## 3. Verify

After applying the SQL, open the app or hit any API that touches the DB
(e.g. `POST /api/branches` is static; better: open Mini App as director → activity tab).

If tables are missing, server logs will print a link back to this SQL Editor.
