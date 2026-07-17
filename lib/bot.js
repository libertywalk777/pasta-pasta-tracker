let botApi = null;
// Runtime cache (also persisted in app_settings when available)
let cachedGroupChatId = null;

function getBot() {
  if (!botApi) {
    try {
      const TelegramBot = require('telegram-bot-api');
      const token = process.env.BOT_TOKEN;
      if (!token) return null;
      botApi = new TelegramBot({ token });
    } catch (e) {
      console.error('Bot init failed:', e.message);
      return null;
    }
  }
  return botApi;
}

async function loadGroupChatIdFromDb() {
  try {
    const { getDb } = require('./db');
    const db = getDb();
    const res = await db.execute(
      "SELECT value FROM app_settings WHERE key = 'group_chat_id' LIMIT 1"
    );
    if (res.rows[0]?.value) {
      const n = Number(res.rows[0].value);
      if (Number.isFinite(n) && n !== 0) {
        cachedGroupChatId = n;
        return n;
      }
    }
  } catch (e) {
    // table may not exist yet
  }
  return null;
}

async function saveGroupChatId(chatId) {
  const n = Number(chatId);
  if (!Number.isFinite(n) || n === 0) return;
  cachedGroupChatId = n;
  try {
    const { getDb } = require('./db');
    const db = getDb();
    await db.execute(
      "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('group_chat_id', ?)",
      [String(n)]
    );
    console.log('[bot] Saved GROUP_CHAT_ID to DB:', n);
  } catch (e) {
    console.warn('[bot] Could not persist group_chat_id:', e.message || e);
  }
}

async function getGroupChatId() {
  const raw = process.env.GROUP_CHAT_ID;
  if (raw != null && raw !== '' && raw !== '0') {
    const n = Number(raw);
    if (Number.isFinite(n) && n !== 0) return n;
  }
  if (cachedGroupChatId) return cachedGroupChatId;
  return await loadGroupChatIdFromDb();
}

// ─── Helpers ────────────────────────────────────────

async function getManagerChatId(branchId) {
  const { getDb } = require('./db');
  const db = getDb();
  const res = await db.execute('SELECT chat_id FROM managers WHERE branch_id = ?', [branchId]);
  if (res.rows.length > 0) return res.rows[0].chat_id;

  const { BRANCHES, FACTORY } = require('./branches');
  const branch = [...BRANCHES, FACTORY].find((b) => b.id === branchId);
  return branch?.manager_chat_id || null;
}

async function registerManager(chatId, username, firstName, branchId) {
  const { getDb } = require('./db');
  const db = getDb();
  await db.execute(
    'INSERT OR REPLACE INTO managers (chat_id, username, first_name, branch_id) VALUES (?, ?, ?, ?)',
    [chatId, username || null, firstName || null, branchId]
  );
}

async function sendGroupMessage(text) {
  const gid = await getGroupChatId();
  if (!gid) {
    console.warn(
      '[bot] GROUP_CHAT_ID not set. Add bot to the group as admin with "Read messages", ' +
        'then open /api/webhook?setup=1 or send any message after adding the bot.'
    );
    return { ok: false, skipped: true, reason: 'no_group_id' };
  }
  const bot = getBot();
  if (!bot) {
    console.warn('[bot] BOT_TOKEN not set — skip group notify');
    return { ok: false, skipped: true, reason: 'no_token' };
  }
  try {
    await bot.sendMessage({ chat_id: gid, text, parse_mode: 'Markdown' });
    return { ok: true, chat_id: gid };
  } catch (e) {
    const msg = e.message || String(e);
    console.error('Group send failed:', msg);
    // Common: bot can't post / not admin / wrong id
    if (/chat not found|bot is not a member|not enough rights|have no rights/i.test(msg)) {
      console.error(
        '[bot] Fix: open group → Трекер → Edit admin rights → enable "Messages" / "Read messages" + allow posting. ' +
          'Also in @BotFather → /setprivacy → Disable (optional for reading all msgs).'
      );
    }
    return { ok: false, error: msg, chat_id: gid };
  }
}

async function sendGroupStatus(deliveryId) {
  const { getDb } = require('./db');
  const db = getDb();
  const res = await db.execute('SELECT * FROM deliveries WHERE id = ?', [deliveryId]);
  const d = res.rows[0];
  if (!d) return;

  const emoji = d.status === 'confirmed' ? '✅' : d.status === 'rejected' ? '❌' : '⏳';
  const label =
    d.status === 'confirmed' ? 'ПОДТВЕРЖДЕНО' : d.status === 'rejected' ? 'ОТКЛОНЕНО' : 'ОЖИДАЕТ';
  const typeLabel = d.type === 'pickup' ? '📦 Забор с фабрики' : '🚚 Доставка на филиал';

  let text =
    `${emoji} *${label}*\n\n${typeLabel}\n` +
    `👤 Водитель: ${d.driver_name}\n📍 ${d.branch_name}\n` +
    `🕐 Время: ${d.created_at}\n📏 Расстояние: ${Math.round(d.distance || 0)} м\n` +
    `🆔 #${d.id}\n`;
  if (d.confirmed_at) text += `📋 Обработано: ${d.confirmed_at}\n`;
  if (d.confirmed_by_name) text += `👤 Управляющий: ${d.confirmed_by_name}\n`;

  await sendGroupMessage(text);
}

/** Called for every new pickup/delivery action — DB already saved */
async function notifyGroupNewDelivery(deliveryId) {
  const { getDb } = require('./db');
  const db = getDb();
  const res = await db.execute('SELECT * FROM deliveries WHERE id = ?', [deliveryId]);
  const d = res.rows[0];
  if (!d) return;

  const typeLabel = d.type === 'pickup' ? '📦 Забор с фабрики' : '🚚 Доставка на филиал';
  const text =
    `⏳ *НОВАЯ ОТМЕТКА*\n\n` +
    `${typeLabel}\n` +
    `👤 Водитель: ${d.driver_name}\n📍 ${d.branch_name}\n` +
    `📏 Расстояние: ${Math.round(d.distance || 0)} м\n🕐 Время: ${d.created_at}\n` +
    `🆔 #${d.id}\n\n` +
    `⏳ Ожидает подтверждения управляющего.`;

  await sendGroupMessage(text);
}

// ─── Shared Confirmation Logic ──────────────────────

async function processDeliveryConfirmation(
  deliveryId,
  newStatus,
  managerId,
  managerName,
  messageIdToEdit = null,
  chatIdToEdit = null
) {
  const { getDb } = require('./db');
  const db = getDb();

  const res = await db.execute('SELECT * FROM deliveries WHERE id = ?', [deliveryId]);
  const delivery = res.rows[0];

  if (!delivery) return { ok: false, error: 'Доставка не найдена' };
  if (delivery.status !== 'pending') return { ok: false, error: 'Уже обработано' };

  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

  await db.execute(
    'UPDATE deliveries SET status = ?, confirmed_at = ?, confirmed_by_id = ?, confirmed_by_name = ? WHERE id = ?',
    [newStatus, now, managerId, managerName, deliveryId]
  );

  const bot = getBot();
  if (bot) {
    const emoji = newStatus === 'confirmed' ? '✅' : '❌';
    const action = newStatus === 'confirmed' ? 'Подтвердил' : 'Отклонил';
    try {
      await bot.sendMessage({
        chat_id: delivery.driver_id,
        text:
          `${emoji} *Доставка ${newStatus === 'confirmed' ? 'подтверждена' : 'отклонена'}!*\n\n` +
          `📍 ${delivery.branch_name}\n🕐 ${delivery.created_at}\n${emoji} ${action}: ${managerName}`,
        parse_mode: 'Markdown',
      });
    } catch {}

    if (messageIdToEdit && chatIdToEdit) {
      const typeLabel = delivery.type === 'pickup' ? '📦 Забор с фабрики' : '🚚 Доставка на филиал';
      const label = newStatus === 'confirmed' ? 'ПОДТВЕРЖДЕНО' : 'ОТКЛОНЕНО';
      try {
        await bot.editMessageText({
          chat_id: chatIdToEdit,
          message_id: messageIdToEdit,
          text:
            `${emoji} *${label}*\n\n${typeLabel}\n👤 Водитель: ${delivery.driver_name}\n📍 ${delivery.branch_name}\n` +
            `🕐 ${delivery.created_at}\n📏 ${Math.round(delivery.distance || 0)} м\n${emoji} ${action}: ${managerName}`,
          parse_mode: 'Markdown',
        });
      } catch {}
    }
  }

  await sendGroupStatus(deliveryId);
  return { ok: true };
}

// ─── Identity helpers ────────────────────────────────

function frontendUrl() {
  if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

async function sendOpenApp(chatId, extraText = '') {
  const bot = getBot();
  if (!bot) return;
  const text =
    (extraText ? extraText + '\n\n' : '') +
    '👋 Добро пожаловать в трекер доставок!\n\nНажмите кнопку ниже, чтобы открыть приложение.\nРоль определится автоматически по номеру телефона.';
  await bot.sendMessage({
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
    reply_markup: JSON.stringify({
      inline_keyboard: [[{ text: '🚚 Открыть трекер', web_app: { url: frontendUrl() } }]],
    }),
  });
}

async function requestPhoneKeyboard(chatId) {
  const bot = getBot();
  if (!bot) return;
  await bot.sendMessage({
    chat_id: chatId,
    text:
      '📱 Чтобы автоматически определить вашу роль (управляющий / развозчик / директор), ' +
      'нажмите кнопку ниже и поделитесь номером телефона.',
    reply_markup: JSON.stringify({
      keyboard: [[{ text: '📱 Отправить мой номер', request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    }),
  });
}

// ─── Handle Telegram Updates (from webhook) ────────

async function handleUpdate(body) {
  const bot = getBot();
  if (!bot) return;

  // Bot added/removed / rights changed in a group → capture real group id
  if (body.my_chat_member) {
    const m = body.my_chat_member;
    const chat = m.chat;
    const newStatus = m.new_chat_member?.status;
    if (chat && (chat.type === 'group' || chat.type === 'supergroup')) {
      if (newStatus === 'administrator' || newStatus === 'member') {
        await saveGroupChatId(chat.id);
        console.log('[bot] Joined group:', chat.title, chat.id, 'status=', newStatus);
        // If admin but restricted — warn in logs
        const can = m.new_chat_member || {};
        if (newStatus === 'administrator' && can.can_post_messages === false) {
          console.warn('[bot] Admin without post rights in', chat.title);
        }
      }
    }
    return;
  }

  // Any group message also pins the chat id (when privacy allows)
  if (body.message?.chat && (body.message.chat.type === 'group' || body.message.chat.type === 'supergroup')) {
    await saveGroupChatId(body.message.chat.id);
  }

  if (body.callback_query) {
    const query = body.callback_query;
    const data = query.data || '';
    const isConfirm = data.startsWith('confirm_');
    const isReject = data.startsWith('reject_');
    if (!isConfirm && !isReject) return;

    const id = Number(data.split('_')[1]);
    const user = query.from;
    if (!user?.id) return;
    const newStatus = isConfirm ? 'confirmed' : 'rejected';

    const result = await processDeliveryConfirmation(
      id,
      newStatus,
      user.id,
      user.first_name || user.username || 'Управляющий',
      query.message?.message_id,
      query.message?.chat?.id
    );

    await bot.answerCallbackQuery({
      callback_query_id: query.id,
      text: result.ok
        ? isConfirm
          ? '✅ Подтверждено!'
          : '❌ Отклонено!'
        : `Ошибка: ${result.error}`,
    });
    return;
  }

  const msg = body.message;
  if (!msg) return;

  const chatId = msg.chat.id;
  const username = msg.from?.username?.replace('@', '') || '';
  const firstName = msg.from?.first_name || '';

  // Contact shared → auto role by phone
  if (msg.contact) {
    // Only accept contact that belongs to the sender (real identity)
    if (msg.contact.user_id && msg.from?.id && Number(msg.contact.user_id) !== Number(msg.from.id)) {
      await bot.sendMessage({
        chat_id: chatId,
        text: '⚠️ Отправьте *свой* контакт, а не чужой номер.',
        parse_mode: 'Markdown',
      });
      return;
    }

    const { resolveIdentity, normalizePhone } = require('./branches');
    const phone = normalizePhone(msg.contact.phone_number);
    const identity = resolveIdentity({ phone, username });

    if (identity.role === 'manager' && identity.branch_id != null) {
      await registerManager(chatId, username, firstName, identity.branch_id);
    }

    try {
      await bot.sendMessage({
        chat_id: chatId,
        text:
          identity.role === 'manager'
            ? `✅ Номер принят. Вы — *управляющий* (${identity.label}).`
            : identity.role === 'director'
              ? '✅ Номер принят. Вы — *директор*.'
              : '✅ Номер принят. Вы — *развозчик*.',
        parse_mode: 'Markdown',
        reply_markup: JSON.stringify({ remove_keyboard: true }),
      });
    } catch {}

    await sendOpenApp(chatId);
    return;
  }

  if (msg.text?.startsWith('/start')) {
    const { resolveIdentity } = require('./branches');
    const identity = resolveIdentity({ username });

    if (identity.role === 'manager' && identity.branch_id != null) {
      await registerManager(chatId, username, firstName, identity.branch_id);
      await bot.sendMessage({
        chat_id: chatId,
        text: `✅ Вы зарегистрированы как управляющий: *${identity.label}*`,
        parse_mode: 'Markdown',
      });
    }

    await requestPhoneKeyboard(chatId);
    await sendOpenApp(
      chatId,
      'Роль определится по номеру. Нажмите «📱 Отправить мой номер», затем откройте трекер.'
    );
    return;
  }

  if (msg.text?.startsWith('/stats')) {
    const today = new Date().toISOString().slice(0, 10);
    const { getDb } = require('./db');
    const db = getDb();
    const res = await db.execute(
      'SELECT status, COUNT(*) as cnt FROM deliveries WHERE created_at LIKE ? GROUP BY status',
      [`${today}%`]
    );
    const s = { confirmed: 0, pending: 0, rejected: 0 };
    res.rows.forEach((r) => (s[r.status] = r.cnt));
    const total = s.confirmed + s.pending + s.rejected;

    await bot.sendMessage({
      chat_id: chatId,
      text:
        `📊 *Статистика за сегодня*\n\n` +
        `✅ Подтверждено: ${s.confirmed}\n⏳ Ожидает: ${s.pending}\n❌ Отклонено: ${s.rejected}\n📦 Всего: ${total}`,
      parse_mode: 'Markdown',
    });
    return;
  }

  // /groupid — show current group chat id (for env setup)
  if (msg.text?.startsWith('/groupid')) {
    const id = msg.chat.id;
    if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
      await saveGroupChatId(id);
      await bot.sendMessage({
        chat_id: id,
        text: `✅ Group chat id сохранён:\n\`${id}\`\n\nДобавьте в Vercel env:\nGROUP_CHAT_ID=${id}`,
        parse_mode: 'Markdown',
      });
    } else {
      await bot.sendMessage({
        chat_id: id,
        text: 'Эту команду нужно отправить *в группе* «ТОВАРКА ПАСТА…».',
        parse_mode: 'Markdown',
      });
    }
  }
}

// ─── Notify manager + group ─────────────────────────

async function notifyManager(deliveryId, branchId) {
  await notifyGroupNewDelivery(deliveryId).catch((e) =>
    console.error('Group notify failed:', e?.message || e)
  );

  const bot = getBot();
  if (!bot) return;

  const { getDb } = require('./db');
  const db = getDb();
  const res = await db.execute('SELECT * FROM deliveries WHERE id = ?', [deliveryId]);
  const d = res.rows[0];
  if (!d) return;

  const chatId = await getManagerChatId(branchId);
  if (!chatId) {
    console.warn(`[bot] No manager chat for branch ${branchId} — group notified only`);
    return;
  }

  const typeLabel = d.type === 'pickup' ? '📦 Забор с фабрики' : '🚚 Доставка на филиал';
  const timeStr = new Date().toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  try {
    await bot.sendMessage({
      chat_id: chatId,
      text:
        `${typeLabel}\n\n👤 Водитель: ${d.driver_name}\n📍 ${d.branch_name}\n` +
        `📏 ${Math.round(d.distance || 0)} м\n🕐 ${timeStr}\n🆔 #${deliveryId}\n\nПодтвердите:`,
      parse_mode: 'Markdown',
      reply_markup: JSON.stringify({
        inline_keyboard: [
          [
            { text: '✅ Подтверждаю', callback_data: `confirm_${deliveryId}` },
            { text: '❌ Не подтверждаю', callback_data: `reject_${deliveryId}` },
          ],
        ],
      }),
    });
  } catch (e) {
    console.error(`Manager notify failed (${branchId}):`, e.message);
  }
}

/**
 * telegram-bot-api@2 does NOT expose setWebhook on the client.
 * Call Telegram HTTP API directly.
 */
async function telegramApi(method, payload = {}) {
  const token = process.env.BOT_TOKEN;
  if (!token) throw new Error('BOT_TOKEN missing');
  const url = `https://api.telegram.org/bot${token}/${method}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    const err = new Error(data.description || `Telegram API ${method} failed (${res.status})`);
    err.telegram = data;
    throw err;
  }
  return data.result;
}

async function setWebhook(webhookUrl) {
  if (!process.env.BOT_TOKEN) return { ok: false, error: 'no_token' };

  try {
    const result = await telegramApi('setWebhook', {
      url: webhookUrl,
      allowed_updates: [
        'message',
        'callback_query',
        'my_chat_member',
        'chat_member',
      ],
      drop_pending_updates: false,
    });
    console.log('✅ Webhook set to:', webhookUrl, result);

    let me = null;
    try {
      me = await telegramApi('getMe');
      console.log('[bot] getMe:', me?.username || me);
    } catch (e) {
      console.warn('[bot] getMe after setup failed:', e.message);
    }

    let info = null;
    try {
      info = await telegramApi('getWebhookInfo');
    } catch {}

    return {
      ok: true,
      webhook: webhookUrl,
      set_result: result,
      bot: me,
      webhook_info: info,
    };
  } catch (e) {
    console.error('setWebhook failed:', e.message, e.telegram || '');
    return {
      ok: false,
      error: e.message,
      telegram: e.telegram || null,
      webhook: webhookUrl,
    };
  }
}

async function diagnoseBot() {
  const gid = await getGroupChatId();
  const result = {
    has_token: !!process.env.BOT_TOKEN,
    group_chat_id: gid || null,
    group_source:
      process.env.GROUP_CHAT_ID && process.env.GROUP_CHAT_ID !== '0'
        ? 'env'
        : gid
          ? 'db/cache'
          : null,
    bot: null,
    webhook_info: null,
    group_send_test: null,
    tips: [],
  };

  if (!process.env.BOT_TOKEN) {
    result.tips.push('Задайте BOT_TOKEN в env (Vercel).');
    return result;
  }

  try {
    result.bot = await telegramApi('getMe');
  } catch (e) {
    result.bot_error = e.message;
  }

  try {
    result.webhook_info = await telegramApi('getWebhookInfo');
  } catch (e) {
    result.webhook_error = e.message;
  }

  if (!gid) {
    result.tips.push(
      'GROUP_CHAT_ID не задан. Добавьте бота админом в группу и отправьте в группе /groupid, ' +
        'или пропишите GROUP_CHAT_ID=-100… в Vercel.'
    );
    result.tips.push(
      'В карточке участника «Трекер» должно быть: админ + доступ к сообщениям (Read messages).'
    );
    result.tips.push('В @BotFather: /setprivacy → Disable (чтобы бот видел сообщения в группе).');
  } else {
    try {
      // Prefer raw API for reliable response shape
      const r = await telegramApi('sendMessage', {
        chat_id: gid,
        text: '✅ Тест связи: бот может писать в группу. (это сообщение можно удалить)',
      });
      result.group_send_test = { ok: true, message_id: r?.message_id };
    } catch (e) {
      result.group_send_test = { ok: false, error: e.message, telegram: e.telegram || null };
      result.tips.push(
        'Бот не смог написать в группу. Откройте группу → Участники → Трекер → ' +
          'права админа: включите «Сообщения» / доступ к сообщениям. ' +
          'Бот не должен быть «ограничен».'
      );
    }
  }

  // Webhook sanity
  const wh = result.webhook_info;
  if (wh) {
    if (!wh.url) {
      result.tips.push('Webhook URL пустой — откройте /api/webhook?setup=1');
    } else if (wh.last_error_message) {
      result.tips.push(`Webhook last error: ${wh.last_error_message}`);
    }
    if (wh.pending_update_count > 50) {
      result.tips.push(`Много pending updates: ${wh.pending_update_count}`);
    }
  }

  return result;
}

module.exports = {
  getBot,
  handleUpdate,
  notifyManager,
  notifyGroupNewDelivery,
  sendGroupStatus,
  setWebhook,
  processDeliveryConfirmation,
  getGroupChatId,
  saveGroupChatId,
  diagnoseBot,
};
