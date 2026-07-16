let botApi = null;

function getBot() {
  if (!botApi) {
    const TelegramBot = require('telegram-bot-api');
    const token = process.env.BOT_TOKEN;
    if (!token) return null;
    botApi = new TelegramBot({ token });
  }
  return botApi;
}

const GROUP_CHAT_ID = () => Number(process.env.GROUP_CHAT_ID || 0);
const MAX_DISTANCE = () => Number(process.env.MAX_DISTANCE_METERS || 300);

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

async function sendGroupStatus(deliveryId) {
  const gid = GROUP_CHAT_ID();
  if (!gid) return;
  const bot = getBot();
  if (!bot) return;

  const { getDb } = require('./db');
  const db = getDb();
  const res = await db.execute('SELECT * FROM deliveries WHERE id = ?', [deliveryId]);
  const d = res.rows[0];
  if (!d) return;

  const emoji = d.status === 'confirmed' ? '✅' : '❌';
  const label = d.status === 'confirmed' ? 'ПОДТВЕРЖДЕНО' : 'ОТКЛОНЕНО';
  const typeLabel = d.type === 'pickup' ? '📦 Забор с фабрики' : '🚚 Доставка на филиал';

  let text =
    `${emoji} *${label}*\n\n${typeLabel}\n` +
    `👤 Водитель: ${d.driver_name}\n📍 ${d.branch_name}\n` +
    `🕐 Доставлено: ${d.created_at}\n📏 Расстояние: ${Math.round(d.distance)} м\n`;
  if (d.confirmed_at) text += `📋 Обработано: ${d.confirmed_at}\n`;
  if (d.confirmed_by_name) text += `👤 Управляющий: ${d.confirmed_by_name}\n`;

  try {
    await bot.sendMessage({ chat_id: gid, text, parse_mode: 'Markdown' });
  } catch (e) {
    console.error('Group send failed:', e.message);
  }
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
            `🕐 ${delivery.created_at}\n📏 ${Math.round(delivery.distance)} м\n${emoji} ${action}: ${managerName}`,
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
    '👋 Добро пожаловать в трекер доставок!\n\nНажмите кнопку ниже, чтобы открыть приложение.';
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

  // Callback queries (confirm/reject)
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

    // Register manager chat if applicable
    if (identity.role === 'manager' && identity.branch_id != null) {
      await registerManager(chatId, username, firstName, identity.branch_id);
    }

    // Remove keyboard
    try {
      await bot.sendMessage({
        chat_id: chatId,
        text:
          identity.role === 'manager'
            ? `✅ Номер принят. Вы — *управляющий* (${identity.label}).\nТеперь вы будете получать уведомления о доставках.`
            : identity.role === 'director'
              ? '✅ Номер принят. Вы — *директор*.'
              : identity.role === 'driver'
                ? '✅ Номер принят. Вы — *развозчик*.'
                : '✅ Номер принят.',
        parse_mode: 'Markdown',
        reply_markup: JSON.stringify({ remove_keyboard: true }),
      });
    } catch {}

    await sendOpenApp(chatId);
    return;
  }

  // /start
  if (msg.text?.startsWith('/start')) {
    const { resolveIdentity } = require('./branches');
    const identity = resolveIdentity({ username });

    // Username-based manager registration (fallback if no phone yet)
    if (identity.role === 'manager' && identity.branch_id != null) {
      await registerManager(chatId, username, firstName, identity.branch_id);
      await bot.sendMessage({
        chat_id: chatId,
        text: `✅ Вы зарегистрированы как управляющий: *${identity.label}*\n\nРекомендуем также отправить номер — так роль определится надёжнее.`,
        parse_mode: 'Markdown',
      });
    }

    await sendOpenApp(chatId);
    // Always offer phone share for automatic role
    await requestPhoneKeyboard(chatId);
    return;
  }

  // /stats
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
}

// ─── Notify manager ─────────────────────────────────

async function notifyGroupNewDelivery(deliveryId) {
  const gid = GROUP_CHAT_ID();
  if (!gid) return;
  const bot = getBot();
  if (!bot) return;

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
    `📏 Расстояние: ${Math.round(d.distance)} м\n🕐 Время: ${d.created_at}\n\n` +
    `⏳ Ожидает подтверждения управляющего.`;

  try {
    await bot.sendMessage({ chat_id: gid, text, parse_mode: 'Markdown' });
  } catch (e) {
    console.error('Group notify failed:', e.message);
  }
}

async function notifyManager(deliveryId, branchId) {
  const bot = getBot();
  if (!bot) return;

  const { getDb } = require('./db');
  const db = getDb();
  const res = await db.execute('SELECT * FROM deliveries WHERE id = ?', [deliveryId]);
  const d = res.rows[0];
  if (!d) return;

  const chatId = await getManagerChatId(branchId);
  if (chatId) {
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
          `📏 ${Math.round(d.distance)} м\n🕐 ${timeStr}\n\nПодтвердите:`,
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

  await notifyGroupNewDelivery(deliveryId).catch((e) => console.error('Group notify failed:', e));
}

// ─── Set webhook ────────────────────────────────────

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
  setWebhook,
  processDeliveryConfirmation,
  MAX_DISTANCE,
};
