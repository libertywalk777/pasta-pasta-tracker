let botApi = null;

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

const GROUP_CHAT_ID = () => {
  const raw = process.env.GROUP_CHAT_ID;
  if (raw == null || raw === '' || raw === '0') return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
};

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
  const gid = GROUP_CHAT_ID();
  if (!gid) {
    console.warn('[bot] GROUP_CHAT_ID not set — skip group notify');
    return { ok: false, skipped: true };
  }
  const bot = getBot();
  if (!bot) {
    console.warn('[bot] BOT_TOKEN not set — skip group notify');
    return { ok: false, skipped: true };
  }
  try {
    await bot.sendMessage({ chat_id: gid, text, parse_mode: 'Markdown' });
    return { ok: true };
  } catch (e) {
    console.error('Group send failed:', e.message);
    return { ok: false, error: e.message };
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
    `🕐 Время: ${d.created_at}\n📏 Расстояние: ${Math.round(d.distance || 0)} м\n`;
  if (d.confirmed_at) text += `📋 Обработано: ${d.confirmed_at}\n`;
  if (d.confirmed_by_name) text += `👤 Управляющий: ${d.confirmed_by_name}\n`;

  await sendGroupMessage(text);
}

/** Called for every new pickup/delivery action — always DB already saved */
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

  // 1) Save to DB
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

  // 2) Always report final status to group
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

  if (body.callback_query) {
    const query = body.callback_query;
    const data = query.data || '';
    const isConfirm = data.startsWith('confirm_');
    const isReject = data.startsWith('reject_');
    if (!isConfirm && !isReject) return;

    const id = Number(data.split('_')[1]);
    const user = query.from;
    const newStatus = isConfirm ? 'confirmed' : 'rejected';

    const result = await processDeliveryConfirmation(
      id,
      newStatus,
      user.id,
      user.first_name,
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
        text: `✅ Вы зарегистрированы как управляющий: *${identity.label}*\n\nОтправьте номер телефона — так роль определится надёжнее.`,
        parse_mode: 'Markdown',
      });
    }

    await sendOpenApp(chatId);
    await requestPhoneKeyboard(chatId);
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
  }
}

// ─── Notify manager + group ─────────────────────────

async function notifyManager(deliveryId, branchId) {
  // Always notify group about the new action (even if manager chat unknown)
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

async function setWebhook(webhookUrl) {
  const bot = getBot();
  if (!bot) return;
  await bot.setWebhook({ url: webhookUrl });
  console.log('✅ Webhook set to:', webhookUrl);
}

module.exports = {
  getBot,
  handleUpdate,
  notifyManager,
  notifyGroupNewDelivery,
  sendGroupStatus,
  setWebhook,
  processDeliveryConfirmation,
};
