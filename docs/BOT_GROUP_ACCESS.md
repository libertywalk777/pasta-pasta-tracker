# Бот «Трекер» — доступ к сообщениям группы

На скрине у **Трекер** написано: *«не имеет доступа к сообщениям»*.  
Из-за этого бот **не видит** чат и **не может** стабильно слать статусы в «ТОВАРКА ПАСТА…».

## 1. Права админа в группе (обязательно)

1. Открой группу → **Участники**
2. Нажми **Трекер**
3. **Изменить права администратора** / Edit admin rights
4. Включи:
   - **Доступ к сообщениям** / Read messages  
   - **Отправка сообщений** / Post messages (если есть)
5. Сохрани

После этого у участника **не** должно быть серой строки «не имеет доступа к сообщениям».

## 2. Privacy mode в BotFather (рекомендуется)

1. Открой [@BotFather](https://t.me/BotFather)
2. `/mybots` → выбери **Трекер**
3. **Bot Settings** → **Group Privacy** → **Turn off**

Иначе бот в группе видит только команды `/…` и mentions, а не обычные сообщения (нужно для авто-детекта `GROUP_CHAT_ID`).

## 3. Env на Vercel

```env
BOT_TOKEN=...токен от BotFather...
GROUP_CHAT_ID=-100xxxxxxxxxx
```

### Как узнать `GROUP_CHAT_ID`

**Вариант A (удобно):**  
1. Добавь бота админом (шаг 1)  
2. В группе напиши: `/groupid`  
3. Бот ответит id и сохранит его в БД  

**Вариант B:**  
Перешли любое сообщение из группы боту [@userinfobot](https://t.me/userinfobot) / @RawDataBot — там будет `"chat":{"id":-100...}`.

## 4. Webhook + диагностика

После деплоя:

```
https://YOUR-APP.vercel.app/api/webhook?setup=1
https://YOUR-APP.vercel.app/api/webhook?diagnose=1
```

`diagnose=1` проверит:
- есть ли `BOT_TOKEN`
- есть ли `GROUP_CHAT_ID` (env или БД)
- может ли бот **написать** тестовое сообщение в группу

## 5. SQL (один раз)

Если таблица `app_settings` ещё не создана — выполни  
[`supabase/migrate_app_settings.sql`](../supabase/migrate_app_settings.sql) в SQL Editor.
