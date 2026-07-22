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

function getBranchById(branchId) {
  const { BRANCHES, FACTORY } = require('./branches');
  if (Number(branchId) === 0) return FACTORY;
  return BRANCHES.find((b) => b.id === Number(branchId)) || null;
}

async function getManagerChatId(branchId) {
  const { getDb } = require('./db');
  const db = getDb();
  const res = await db.execute('SELECT chat_id FROM managers WHERE branch_id = ?', [branchId]);
  if (res.rows.length > 0) return res.rows[0].chat_id;

  const branch = getBranchById(branchId);
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

/**
 * Who may confirm/reject a delivery for branchId?
 * Only the responsible manager of THAT branch (not other managers, not random users).
 * Directors are NOT auto-allowed unless they are also the branch manager.
 */
async function canUserConfirmBranch(user, branchId) {
  if (!user?.id) return { ok: false, reason: 'no_user' };
  const bid = Number(branchId);
  const username = (user.username || '').replace(/^@/, '').toLowerCase();
  const branch = getBranchById(bid);
  const responsible = branch?.manager_username
    ? `@${branch.manager_username}`
    : 'ответственный управляющий';

  // 1) Static roster username (fast, no DB) — primary path in groups
  if (
    branch?.manager_username &&
    username &&
    branch.manager_username.toLowerCase() === username
  ) {
    return { ok: true, via: 'roster.username', manager_username: branch.manager_username };
  }

  // 2) Registered manager chat_id bound to this branch
  try {
    const { getDb } = require('./db');
    const db = getDb();
    const byChat = await db.execute(
      'SELECT chat_id, username, branch_id FROM managers WHERE chat_id = ?',
      [Number(user.id)]
    );
    if (byChat.rows[0] && Number(byChat.rows[0].branch_id) === bid) {
      return { ok: true, via: 'managers.chat_id' };
    }

    // 3) user_access ACL: manager of this branch
    const byAccess = await db.execute(
      'SELECT * FROM user_access WHERE telegram_id = ?',
      [Number(user.id)]
    );
    if (
      byAccess.rows[0] &&
      byAccess.rows[0].role === 'manager' &&
      Number(byAccess.rows[0].branch_id) === bid
    ) {
      return { ok: true, via: 'user_access' };
    }

    if (username) {
      const byUserAccess = await db.execute(
        'SELECT * FROM user_access WHERE LOWER(telegram_username) = ?',
        [username]
      );
      if (
        byUserAccess.rows[0] &&
        byUserAccess.rows[0].role === 'manager' &&
        Number(byUserAccess.rows[0].branch_id) === bid
      ) {
        return { ok: true, via: 'user_access.username' };
      }
    }
  } catch (e) {
    console.warn('[bot] canUserConfirmBranch DB error:', e.message || e);
  }

  return {
    ok: false,
    reason: 'not_responsible',
    responsible,
    branch_name: branch?.name || String(bid),
  };
}

function confirmKeyboard(deliveryId) {
  return {
    inline_keyboard: [
      [
        { text: '✅ Подтверждаю', callback_data: `confirm_${deliveryId}` },
        { text: '❌ Отклоняю', callback_data: `reject_${deliveryId}` },
      ],
    ],
  };
}

/** Escape text for Telegram HTML parse_mode */
function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function sendGroupMessage(text, options = {}) {
  const gid = await getGroupChatId();
  if (!gid) {
    console.warn(
      '[bot] GROUP_CHAT_ID not set. Add bot to the group as admin with "Read messages", ' +
        'then open /api/webhook?setup=1 or send any message after adding the bot.'
    );
    return { ok: false, skipped: true, reason: 'no_group_id' };
  }
  if (!process.env.BOT_TOKEN) {
    console.warn('[bot] BOT_TOKEN not set — skip group notify');
    return { ok: false, skipped: true, reason: 'no_token' };
  }

  // Prefer HTML — Markdown breaks on usernames like @Ibn_Abdulloh (_ = italic)
  const parseMode = options.parse_mode || 'HTML';
  const payload = {
    chat_id: gid,
    text,
    parse_mode: parseMode,
  };
  if (options.reply_markup) {
    payload.reply_markup = options.reply_markup;
  }

  try {
    const result = await telegramApi('sendMessage', payload);
    return { ok: true, chat_id: gid, message_id: result?.message_id };
  } catch (e) {
    const msg = e.message || String(e);
    console.error('Group send failed (html):', msg, e.telegram || '');
    // Retry without parse_mode (still with buttons)
    try {
      const plain = { chat_id: gid, text: String(text).replace(/<[^>]+>/g, '') };
      if (options.reply_markup) plain.reply_markup = options.reply_markup;
      const result = await telegramApi('sendMessage', plain);
      return { ok: true, chat_id: gid, message_id: result?.message_id, plain: true };
    } catch (e2) {
      console.error('Group send plain failed:', e2.message, e2.telegram || '');
      return { ok: false, error: e2.message || msg, chat_id: gid };
    }
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
    `${emoji} <b>${escapeHtml(label)}</b>\n\n${typeLabel}\n` +
    `👤 Водитель: ${escapeHtml(d.driver_name)}\n📍 ${escapeHtml(d.branch_name)}\n` +
    `🕐 Время: ${escapeHtml(d.created_at)}\n📏 Расстояние: ${Math.round(d.distance || 0)} м\n` +
    `🆔 #${d.id}\n`;
  if (d.confirmed_at) text += `📋 Обработано: ${escapeHtml(d.confirmed_at)}\n`;
  if (d.confirmed_by_name) text += `👤 Управляющий: ${escapeHtml(d.confirmed_by_name)}\n`;

  // Final status — no buttons
  const r = await sendGroupMessage(text, { parse_mode: 'HTML' });
  if (!r.ok) console.error('[bot] sendGroupStatus failed:', r);
  return r;
}

/** New delivery → group message WITH confirm/reject buttons (manager-only) */
async function notifyGroupNewDelivery(deliveryId) {
  const { getDb } = require('./db');
  const db = getDb();
  const res = await db.execute('SELECT * FROM deliveries WHERE id = ?', [deliveryId]);
  const d = res.rows[0];
  if (!d) {
    console.error('[bot] notifyGroupNewDelivery: delivery not found', deliveryId);
    return { ok: false, error: 'not_found' };
  }

  const branch = getBranchById(d.branch_id);
  const managerTag = branch?.manager_username ? `@${branch.manager_username}` : 'управляющий';
  const typeLabel = d.type === 'pickup' ? '📦 Забор с фабрики' : '🚚 Доставка на филиал';

  const text =
    `⏳ <b>НОВАЯ ОТМЕТКА</b>\n\n` +
    `${typeLabel}\n` +
    `👤 Водитель: ${escapeHtml(d.driver_name)}\n📍 ${escapeHtml(d.branch_name)}\n` +
    `📏 Расстояние: ${Math.round(d.distance || 0)} м\n🕐 Время: ${escapeHtml(d.created_at)}\n` +
    `🆔 #${d.id}\n\n` +
    `🔐 Подтвердить может только: ${escapeHtml(managerTag)}\n` +
    `⏳ Ожидает подтверждения.`;

  const r = await sendGroupMessage(text, {
    parse_mode: 'HTML',
    reply_markup: confirmKeyboard(deliveryId),
  });
  if (!r.ok) console.error('[bot] notifyGroupNewDelivery failed:', r);
  else console.log('[bot] group notified delivery', deliveryId, 'msg', r.message_id);
  return r;
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
  if (delivery.status !== 'pending') return { ok: false, error: 'Уже обработано', already: true };

  const { nowLocal } = require('./time');
  const now = nowLocal();

  await db.execute(
    'UPDATE deliveries SET status = ?, confirmed_at = ?, confirmed_by_id = ?, confirmed_by_name = ? WHERE id = ?',
    [newStatus, now, managerId, managerName, deliveryId]
  );

  const emoji = newStatus === 'confirmed' ? '✅' : '❌';
  const action = newStatus === 'confirmed' ? 'Подтвердил' : 'Отклонил';
  const typeLabel = delivery.type === 'pickup' ? '📦 Забор с фабрики' : '🚚 Доставка на филиал';
  const label = newStatus === 'confirmed' ? 'ПОДТВЕРЖДЕНО' : 'ОТКЛОНЕНО';

  const finalText =
    `${emoji} <b>${escapeHtml(label)}</b>\n\n${typeLabel}\n` +
    `👤 Водитель: ${escapeHtml(delivery.driver_name)}\n📍 ${escapeHtml(delivery.branch_name)}\n` +
    `🕐 ${escapeHtml(delivery.created_at)}\n📏 ${Math.round(delivery.distance || 0)} м\n` +
    `🆔 #${delivery.id}\n` +
    `${emoji} ${escapeHtml(action)}: ${escapeHtml(managerName)}\n` +
    `📋 ${escapeHtml(now)}`;

  // 1) ALWAYS edit original message first (group or private) — never post a duplicate if edit works
  let edited = false;
  if (messageIdToEdit && chatIdToEdit) {
    try {
      await telegramApi('editMessageText', {
        chat_id: chatIdToEdit,
        message_id: messageIdToEdit,
        text: finalText,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [] },
      });
      edited = true;
      console.log('[bot] edited message', chatIdToEdit, messageIdToEdit, 'delivery', deliveryId);
    } catch (e) {
      console.warn('[bot] editMessageText failed:', e.message, e.telegram || '');
      // Try strip buttons at least
      try {
        await telegramApi('editMessageReplyMarkup', {
          chat_id: chatIdToEdit,
          message_id: messageIdToEdit,
          reply_markup: { inline_keyboard: [] },
        });
      } catch {}
    }
  }

  // 2) Only if we could NOT edit the original message — post status once
  if (!edited) {
    console.warn('[bot] fallback sendGroupStatus because edit failed/missing', {
      deliveryId,
      messageIdToEdit,
      chatIdToEdit,
    });
    await sendGroupStatus(deliveryId);
  }

  // 3) Notify driver privately (best-effort, does not affect group edit)
  try {
    await telegramApi('sendMessage', {
      chat_id: delivery.driver_id,
      text:
        `${emoji} <b>Доставка ${newStatus === 'confirmed' ? 'подтверждена' : 'отклонена'}!</b>\n\n` +
        `📍 ${escapeHtml(delivery.branch_name)}\n🕐 ${escapeHtml(delivery.created_at)}\n` +
        `${emoji} ${escapeHtml(action)}: ${escapeHtml(managerName)}`,
      parse_mode: 'HTML',
    });
  } catch (e) {
    console.warn('[bot] driver notify failed:', e.message);
  }

  return { ok: true, edited };
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
  if (!bot && !process.env.BOT_TOKEN) return;

  // Bot added/removed / rights changed in a group → capture real group id
  if (body.my_chat_member) {
    const m = body.my_chat_member;
    const chat = m.chat;
    const newStatus = m.new_chat_member?.status;
    if (chat && (chat.type === 'group' || chat.type === 'supergroup')) {
      if (newStatus === 'administrator' || newStatus === 'member') {
        await saveGroupChatId(chat.id);
        console.log('[bot] Joined group:', chat.title, chat.id, 'status=', newStatus);
        const can = m.new_chat_member || {};
        if (newStatus === 'administrator' && can.can_post_messages === false) {
          console.warn('[bot] Admin without post rights in', chat.title);
        }
      }
    }
    return;
  }

  // Any group message also pins the chat id (when privacy allows)
  if (
    body.message?.chat &&
    (body.message.chat.type === 'group' || body.message.chat.type === 'supergroup')
  ) {
    await saveGroupChatId(body.message.chat.id);
  }

  // ── Inline buttons: confirm / reject ──
  if (body.callback_query) {
    const query = body.callback_query;
    const data = query.data || '';
    const isConfirm = data.startsWith('confirm_');
    const isReject = data.startsWith('reject_');
    if (!isConfirm && !isReject) {
      await answerCallback(query.id, '');
      return;
    }

    const deliveryId = Number(String(data).split('_')[1]);
    const user = query.from || {};
    const msgChatId = query.message?.chat?.id;
    const msgId = query.message?.message_id;

    console.log('[bot] callback', {
      data,
      deliveryId,
      from: user.username || user.id,
      chat: msgChatId,
      message_id: msgId,
    });

    if (!user?.id || !deliveryId) {
      await answerCallback(query.id, 'Ошибка данных', true);
      return;
    }

    // Load delivery first
    let delivery = null;
    try {
      const { getDb } = require('./db');
      const db = getDb();
      const dres = await db.execute('SELECT * FROM deliveries WHERE id = ?', [deliveryId]);
      delivery = dres.rows[0] || null;
    } catch (e) {
      console.error('[bot] callback DB load failed:', e.message || e);
      await answerCallback(query.id, 'Ошибка БД', true);
      return;
    }

    if (!delivery) {
      await answerCallback(query.id, 'Доставка не найдена', true);
      return;
    }
    if (delivery.status !== 'pending') {
      await answerCallback(query.id, 'Уже обработано', true);
      // strip buttons / show final if still pending UI
      if (msgId && msgChatId) {
        try {
          await telegramApi('editMessageReplyMarkup', {
            chat_id: msgChatId,
            message_id: msgId,
            reply_markup: { inline_keyboard: [] },
          });
        } catch {}
      }
      return;
    }

    // 🔐 Only responsible branch manager
    const auth = await canUserConfirmBranch(user, delivery.branch_id);
    console.log('[bot] callback auth', auth);
    if (!auth.ok) {
      const who = auth.responsible || 'ответственный управляющий';
      const br = auth.branch_name || '';
      await answerCallback(query.id, `⛔ Только ${who}${br ? ' (' + br + ')' : ''}`, true);
      return;
    }

    const newStatus = isConfirm ? 'confirmed' : 'rejected';
    try {
      const result = await processDeliveryConfirmation(
        deliveryId,
        newStatus,
        user.id,
        user.first_name || user.username || 'Управляющий',
        msgId,
        msgChatId
      );

      await answerCallback(
        query.id,
        result.ok
          ? isConfirm
            ? '✅ Подтверждено!'
            : '❌ Отклонено!'
          : `Ошибка: ${result.error || 'unknown'}`,
        !result.ok
      );
    } catch (e) {
      console.error('[bot] processDeliveryConfirmation error:', e);
      await answerCallback(query.id, 'Ошибка обработки', true);
    }
    return;
  }

  const msg = body.message;
  if (!msg) return;

  // Need bot client for private chat replies below
  if (!bot) return;

  const chatId = msg.chat.id;
  const username = msg.from?.username?.replace('@', '') || '';
  const firstName = msg.from?.first_name || '';

  // Contact shared → auto role by phone
  if (msg.contact) {
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
    const { todayLocal } = require('./time');
    const today = todayLocal();
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
        text: 'Эту команду нужно отправить *в группе*.',
        parse_mode: 'Markdown',
      });
    }
  }
}

async function answerCallback(callbackQueryId, text, showAlert = false) {
  if (!callbackQueryId) return;
  // Telegram limit ~200 chars for callback toast/alert
  const safe = String(text || '').slice(0, 180);
  try {
    await telegramApi('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      text: safe,
      show_alert: !!showAlert,
    });
  } catch (e) {
    console.warn('[bot] answerCallbackQuery failed:', e.message, e.telegram || '');
  }
}

// ─── Notify manager + group ─────────────────────────

async function notifyManager(deliveryId, branchId) {
  // Group first — with inline buttons for the responsible manager
  await notifyGroupNewDelivery(deliveryId).catch((e) =>
    console.error('Group notify failed:', e?.message || e)
  );

  const bot = getBot();
  if (!bot && !process.env.BOT_TOKEN) return;

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
  const { timeLocal } = require('./time');
  const timeStr = timeLocal();

  const text =
    `${typeLabel}\n\n👤 Водитель: ${escapeHtml(d.driver_name)}\n📍 ${escapeHtml(d.branch_name)}\n` +
    `📏 ${Math.round(d.distance || 0)} м\n🕐 ${escapeHtml(timeStr)}\n🆔 #${deliveryId}\n\n` +
    `Подтвердите (только вы как управляющий этого филиала):`;

  try {
    await telegramApi('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      reply_markup: confirmKeyboard(deliveryId),
    });
  } catch (e) {
    console.error(`Manager notify failed (${branchId}):`, e.message, e.telegram || '');
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
      const r = await telegramApi('sendMessage', {
        chat_id: gid,
        text: '✅ Тест связи: бот может писать в группу. (это сообщение можно удалить)',
      });
      result.group_send_test = { ok: true, message_id: r?.message_id };
    } catch (e) {
      result.group_send_test = { ok: false, error: e.message, telegram: e.telegram || null };
      result.tips.push(
        'Бот не смог написать в группу. Откройте группу → Участники → Трекер → ' +
          'права админа: включите «Сообщения» / доступ к сообщениям.'
      );
    }
  }

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
  canUserConfirmBranch,
};
