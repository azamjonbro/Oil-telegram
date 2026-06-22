const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
const Calendar = require("telegram-inline-calendar");
require("dotenv").config();

// ─────────────────────────────────────────
//  CONFIG
// ─────────────────────────────────────────
const TOKEN    = process.env.TELEGRAM_BOT_TOKEN;
const API_BASE = process.env.API_BASE || "http://localhost:7766";
// const ADMIN_ID = Number(process.env.ADMIN_ID) || 2043384301;
const ADMIN_ID = 231199271;


const POLLING_OPTIONS = {
  polling: {
    interval: 2000,
    autoStart: true,
    params: { timeout: 10 },
  },
};

if (process.env.SOCKS5_PROXY) {
  const { SocksProxyAgent } = require("socks-proxy-agent");
  POLLING_OPTIONS.request = {
    agent: new SocksProxyAgent(process.env.SOCKS5_PROXY),
  };
}

let bot = new TelegramBot(TOKEN, POLLING_OPTIONS);

const calendar = new Calendar(bot, {
  date_format: "YYYY-MM-DD",
  language: "en",
});

// ─────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────
function formatDate(date) {
  if (!date) return "—";
  const d = new Date(date);
  return [
    String(d.getDate()).padStart(2, "0"),
    String(d.getMonth() + 1).padStart(2, "0"),
    d.getFullYear(),
  ].join("-");
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// ─────────────────────────────────────────
//  KEYBOARDS
// ─────────────────────────────────────────
const adminKeyboard = {
  reply_markup: {
    keyboard: [
      [{ text: "📅 Sana tanlash (Calendar)" }],
      [{ text: "🌐 Ilovani ochish", web_app: { url: "https://oilprojects.netlify.app/" } }],
    ],
    resize_keyboard: true,
  },
};

function userInlineMenu(userId) {
  return {
    inline_keyboard: [
      [
        { text: "📥 Moy almashtirish tarixi", callback_data: `checklist_${userId}` },
        { text: "💰 Balans",                  callback_data: `balance_${userId}`   },
      ],
    ],
  };
}

function backButton(userId) {
  return {
    inline_keyboard: [
      [{ text: "🔙 Ortga", callback_data: `back_${userId}` }],
    ],
  };
}

// ─────────────────────────────────────────
//  API CALLS
// ─────────────────────────────────────────
async function apiGet(path, params = {}) {
  const { data } = await axios.get(`${API_BASE}${path}`, { params, timeout: 8000 });
  return data;
}

async function apiPost(path, body = {}) {
  const { data } = await axios.post(`${API_BASE}${path}`, body, { timeout: 8000 });
  return data;
}

async function apiPut(path, body = {}) {
  const { data } = await axios.put(`${API_BASE}${path}`, body, { timeout: 8000 });
  return data;
}

// ─────────────────────────────────────────
//  /start
// ─────────────────────────────────────────
bot.onText(/\/start(?:\s+(.+))?/, async (msg) => {
  const chatId = msg.chat.id;
  const name   = msg.from.first_name || "Foydalanuvchi";

  if (chatId === ADMIN_ID) {
    return bot.sendMessage(chatId, "⚙️ Admin panel:", adminKeyboard);
  }

  try {
    const user = await apiGet("/clients/chatId", { id: chatId });
    if (user) {
      return bot.sendMessage(
        chatId,
        `👋 Xush kelibsiz, ${name}!`,
        { reply_markup: userInlineMenu(user._id) }
      );
    }
  } catch (err) {
    if (err.response?.status !== 404) {
      console.error("/start apiGet error:", err.message);
      return bot.sendMessage(chatId, "⚠️ Server bilan bog'lanib bo'lmadi. Keyinroq urinib ko'ring.");
    }
  }

  return bot.sendMessage(
    chatId,
    `Assalomu alaykum, ${name}!\n\n📱 Telefon raqamingizni yuboring:`,
    {
      reply_markup: {
        keyboard: [[{ text: "📞 Telefon raqamni yuborish", request_contact: true }]],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    }
  );
});

// ─────────────────────────────────────────
//  CALENDAR (admin)
// ─────────────────────────────────────────
bot.onText(/📅 Sana tanlash \(Calendar\)/, (msg) => {
  const chatId = msg.chat.id;
  if (chatId !== ADMIN_ID) return;
  bot.sendMessage(chatId, "📅 Boshlanish sanasini tanlang:");
  calendar.startNavCalendar(msg);
});

// ─────────────────────────────────────────
//  CONTACT
// ─────────────────────────────────────────
bot.on("contact", async (msg) => {
  const chatId = msg.chat.id;

  if (chatId === ADMIN_ID) {
    return bot.sendMessage(chatId, "Admin ro'yxatdan o'tolmaydi.");
  }

  let phone = msg.contact.phone_number;
  if (!phone.startsWith("+")) phone = "+" + phone;

  try {
    const data = await apiPost("/clients/phone", { phone });

    if (!data?.exists) {
      return bot.sendMessage(chatId, "ℹ️ Siz bo'yicha ma'lumot topilmadi.");
    }

    const user = data.user;
    await apiPut("/clients/chatId", { chatId, userId: user._id });

    return bot.sendMessage(
      chatId,
      `✅ Hurmatli ${user.name}, ro'yxatdan o'tish yakunlandi!`,
      {
        reply_markup: {
          remove_keyboard: true,
          inline_keyboard: userInlineMenu(user._id).inline_keyboard,
        },
      }
    );
  } catch (err) {
    console.error("CONTACT error:", err.message);
    bot.sendMessage(chatId, "❌ Ro'yxatdan o'tishda xatolik yuz berdi.");
  }
});

// ─────────────────────────────────────────
//  CALLBACKS
// ─────────────────────────────────────────
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const data   = query.data;

  // ── Calendar callback ──
  let isCalendar = false;
  try {
    isCalendar = calendar.clickButtonCalendar(query);
  } catch (_) {}

  if (isCalendar) {
    const dateMatch = data.match(/(\d{4}-\d{2}-\d{2})/);

    if (!dateMatch) {
      try { await bot.answerCallbackQuery(query.id); } catch (_) {}
      return;
    }

    const fromDate = dateMatch[1];
    const toDate   = todayISO();

    try { await bot.answerCallbackQuery(query.id); } catch (_) {}

    if (fromDate > toDate) {
      return bot.sendMessage(
        chatId,
        `⚠️ Tanlangan sana (${fromDate}) hali kelmagan. Bugungi yoki o'tgan sanani tanlang.`
      );
    }

    let waitMsg;
    try {
      waitMsg = await bot.sendMessage(chatId, "⏳ Xabarlar yuborilmoqda...");

      const { data: result } = await axios.post(
        `${API_BASE}/clients/notify-admin`,
        { fromDate, toDate },
        { timeout: 60000 }
      );

      await bot.deleteMessage(chatId, waitMsg.message_id).catch(() => {});

      return bot.sendMessage(
        chatId,
        `✅ ${fromDate} → ${toDate} oralig'ida ${result.count ?? 0} ta xabar yuborildi.`
      );
    } catch (err) {
      console.error("notify-admin error:", err.message);
      if (waitMsg) await bot.deleteMessage(chatId, waitMsg.message_id).catch(() => {});
      return bot.sendMessage(chatId, "❌ Xabar yuborishda xatolik yuz berdi.");
    }
  }

  // ── Oddiy callback'lar ──
  try { await bot.answerCallbackQuery(query.id); } catch (_) {}

  const resolveTarget = (id) => (chatId === ADMIN_ID ? id : String(chatId));

  try {

    // ── CHECKLIST ──
    if (data.startsWith("checklist_")) {
      const userId   = data.split("_")[1];
      const targetId = resolveTarget(userId);

      const user = await apiGet(`/clients/${targetId}`);
      if (!user) return bot.sendMessage(chatId, "❌ Foydalanuvchi topilmadi.");

      if (!user.history?.length) {
        return bot.sendMessage(chatId, "📭 Servis tarixi mavjud emas.", {
          reply_markup: backButton(userId),
        });
      }

      const latest = user.history.at(-1);
      const text =
        `📋 *Moy almashtirish tarixi*\n\n` +
        `🚗 *Mashina:* ${user.carBrand} — ${user.carNumber}\n` +
        `📅 *Bildirishnoma sanasi:* ${formatDate(latest.notificationDate)}\n` +
        `🛢 *Kilometr:* ${latest.klameter ?? "—"} km\n` +
        `📨 *Holati:* ${latest.notified ? "✅ yuborilgan" : "⏳ yuborilmagan"}`;

      return bot.sendMessage(chatId, text, {
        parse_mode: "Markdown",
        reply_markup: backButton(userId),
      });
    }

    // ── BALANCE ──
    else if (data.startsWith("balance_")) {
      const userId   = data.split("_")[1];
      const targetId = resolveTarget(userId);

      const user = await apiGet(`/clients/${targetId}`);
      if (!user) return bot.sendMessage(chatId, "❌ Foydalanuvchi topilmadi.");

      return bot.sendMessage(
        chatId,
        `💰 *Balans:* ${user.balance ?? 0} so'm`,
        { parse_mode: "Markdown", reply_markup: backButton(userId) }
      );
    }

    // ── LOAD (admin) ──
    else if (data.startsWith("load_") && chatId === ADMIN_ID) {
      const userId = data.split("_")[1];

      const user = await apiGet(`/clients/${userId}`);
      if (!user) return bot.sendMessage(chatId, "❌ Foydalanuvchi topilmadi.");

      const latest = user.history?.at(-1);
      if (!latest) return bot.sendMessage(chatId, "📭 Servis tarixi mavjud emas.");

      const text =
        `👤 *${user.name}*\n` +
        `🚗 ${user.carBrand} / ${user.carNumber}\n` +
        `📱 ${user.phone}\n\n` +
        `🛢 *Moy:* ${latest.oilBrand ?? "—"}\n` +
        `📏 *Kilometr:* ${latest.klameter ?? "—"} km\n` +
        `📅 *Quyilgan:* ${formatDate(latest.filledAt)}\n` +
        `📅 *Alishtirish:* ${formatDate(latest.nextChangeAt)}\n` +
        `📆 *Bildirishnoma:* ${formatDate(latest.notificationDate)}\n` +
        `📨 *Holati:* ${latest.notified ? "✅ yuborilgan" : "⏳ yuborilmagan"}`;

      return bot.sendMessage(chatId, text, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "📤 Mijozga yuborish", callback_data: `send_${userId}` }],
            [{ text: "🔙 Ortga",            callback_data: `back_${userId}` }],
          ],
        },
      });
    }

    // ── SEND (admin) ──
    else if (data.startsWith("send_") && chatId === ADMIN_ID) {
      const userId = data.split("_")[1];

      const user = await apiGet(`/clients/${userId}`);
      if (!user) return bot.sendMessage(chatId, "❌ Foydalanuvchi topilmadi.");

      if (!user.chatId) {
        return bot.sendMessage(chatId, "⚠️ Bu foydalanuvchining Telegram chatId si yo'q.");
      }

      const latest = user.history?.at(-1);
      if (!latest) return bot.sendMessage(chatId, "❌ Servis tarixi yo'q.");

      const text =
        `Hurmatli ${user.name},\n\n` +
        `🚗 ${user.carBrand} / ${user.carNumber}\n\n` +
        `Eslatib o'tamiz:\n` +
        `🛢 ${latest.klameter} km da moy almashtirishingiz kerak.\n` +
        `📅 Yoki ${formatDate(latest.notificationDate)} sanasigacha.`;

      await bot.sendMessage(user.chatId, text);
      return bot.sendMessage(chatId, "✅ Mijozga muvaffaqiyatli yuborildi!", {
        reply_markup: backButton(userId),
      });
    }

    // ── BACK ──
    else if (data.startsWith("back_")) {
      const userId = data.split("_")[1];
      return bot.sendMessage(chatId, "📋 Asosiy menyu:", {
        reply_markup: chatId === ADMIN_ID
          ? adminKeyboard.reply_markup
          : userInlineMenu(userId),
      });
    }

  } catch (err) {
    console.error("CALLBACK ERROR:", err.message, err.response?.data);
    try { await bot.sendMessage(chatId, "❌ Server bilan aloqa xatosi."); } catch (_) {}
  }
});

// ─────────────────────────────────────────
//  POLLING ERROR — auto restart
// ─────────────────────────────────────────
let isRestarting = false;

bot.on("polling_error", (err) => {
  if (err.name === "AggregateError" || Array.isArray(err.errors)) {
    const messages = (err.errors || []).map((e) => e.message).join(", ");
    console.error(`⚠️ POLLING AggregateError: ${messages}`);
  } else {
    console.error(`⚠️ POLLING ERROR [${err.code}]:`, err.message);
  }

  if (err.code === "ETELEGRAM" && err.message?.includes("409")) {
    console.error("❌ 409 Conflict: Boshqa bot instance ishlayapti! Jarayonni to'xtating.");
    process.exit(1);
  }

  if (!isRestarting) {
    isRestarting = true;
    console.log("🔄 5 soniyadan so'ng qayta ulanish...");

    setTimeout(async () => {
      try {
        await bot.stopPolling();
        await new Promise((r) => setTimeout(r, 1000));
        await bot.startPolling();
        console.log("✅ Polling qayta boshlandi.");
      } catch (restartErr) {
        console.error("❌ Qayta ulanishda xato:", restartErr.message);
        process.exit(1);
      } finally {
        isRestarting = false;
      }
    }, 5000);
  }
});

// ─────────────────────────────────────────
//  PROCESS ERROR HANDLERS
// ─────────────────────────────────────────
process.on("unhandledRejection", (reason) => {
  console.error("⚠️ unhandledRejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("❌ uncaughtException:", err.message);
  process.exit(1);
});

console.log("✅ Bot ishga tushdi...");