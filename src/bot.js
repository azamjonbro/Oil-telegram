const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
require("dotenv").config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });
const Calendar = require("telegram-inline-calendar");

const API_BASE = "https://oil.techinfo.uz";
const ADMIN_ID = 231199271;

const calendar = new Calendar(bot, {
  date_format: "YYYY-MM-DD",
  language: "en",
});

// ================= HELPERS =================
function formatDate(date) {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

const userMenu = (userId) => ({
  inline_keyboard: [
    [
      {
        text: "📥 Moy almashtirish tarixi",
        callback_data: `checklist_${userId}`,
      },
      {
        text: "📊 Balans",
        callback_data: `balance_${userId}`,
      },
    ],
  ],
});

// ================= /start =================
bot.onText(/\/start(?:\s+(.+))?/, async (msg) => {
  const chatId = msg.chat.id;

  // ADMIN
  if (chatId === ADMIN_ID) {
    return bot.sendMessage(chatId, "⚙️ Admin panel:", {
      reply_markup: {
        keyboard: [
          [{ text: "Calendar" }],
          [
            {
              text: "🌐 Ilovani ochish",
              web_app: { url: "https://oilprojects.netlify.app/" },
            },
          ],
        ],
        resize_keyboard: true,
      },
    });
  }

  // USER — mavjudligini tekshir
  let user = null;
  try {
    const res = await axios.get(`${API_BASE}/clients/chatId`, {
      params: { id: chatId },
      timeout: 5000,
    });
    user = res.data;
  } catch (err) {
    if (err.response?.status !== 404) {
      console.error("❌ /start backend error:", err.message);
      return bot.sendMessage(
        chatId,
        "⚠️ Server bilan bog'lanib bo'lmadi. Keyinroq urinib ko'ring."
      );
    }
  }

  if (user) {
    return bot.sendMessage(
      chatId,
      `👋 Xush kelibsiz, ${msg.from.first_name}!`,
      { reply_markup: userMenu(user._id) }
    );
  }

  // Yangi user — telefon so'ra
  return bot.sendMessage(
    chatId,
    `Assalomu alaykum ${msg.from.first_name}!\n\n📱 Telefon raqamingizni yuboring:`,
    {
      reply_markup: {
        keyboard: [
          [{ text: "📞 Telefon raqamni yuborish", request_contact: true }],
        ],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    }
  );
});

// ================= CALENDAR (admin) =================
bot.onText(/Calendar/, (msg) => {
  const chatId = msg.chat.id;

  if (chatId !== ADMIN_ID) {
    return bot.sendMessage(chatId, "❌ Bu buyruq faqat admin uchun.");
  }

  bot.sendMessage(chatId, "📅 Kerakli sanani tanlang:");
  calendar.startNavCalendar(msg);
});

// ================= CONTACT =================
bot.on("contact", async (msg) => {
  const chatId = msg.chat.id;

  if (chatId === ADMIN_ID) {
    return bot.sendMessage(
      chatId,
      "Admin foydalanuvchi sifatida ro'yxatdan o'tolmaydi."
    );
  }

  let phoneNumber = msg.contact.phone_number;
  if (!phoneNumber.startsWith("+")) {
    phoneNumber = "+" + phoneNumber;
  }

  console.log("📞 Phone:", phoneNumber);

  try {
    const { data } = await axios.post(
      `${API_BASE}/clients/phone`,
      { phone: phoneNumber },
      { timeout: 5000 }
    );

    if (!data?.exists) {
      return bot.sendMessage(chatId, "ℹ️ Siz bo'yicha ma'lumot topilmadi.");
    }

    const user = data.user;

    await axios.put(
      `${API_BASE}/clients/chatId`,
      { chatId, userId: user._id },
      { timeout: 5000 }
    );

    return bot.sendMessage(
      chatId,
      `✅ Hurmatli ${user.name}, ro'yxatdan o'tish yakunlandi!`,
      {
        reply_markup: {
          remove_keyboard: true,
          inline_keyboard: userMenu(user._id).inline_keyboard,
        },
      }
    );
  } catch (err) {
    console.error("❌ CONTACT error:", {
      status: err.response?.status,
      data: err.response?.data,
      message: err.message,
    });
    bot.sendMessage(chatId, "❌ Ro'yxatdan o'tishda xatolik yuz berdi.");
  }
});

// ================= CALLBACKS =================
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  try {
    // --- Calendar callback'larini birinchi tekshir ---
    // clickButtonCalendar faqat calendar tegishli bo'lsa true qaytaradi
    const isCalendar = calendar.clickButtonCalendar(query);

    if (isCalendar) {
      // "n_YYYY-MM-DD" formatidagi date selection callback
      if (data.startsWith("n_") && data.length >= 12) {
        const date = data.slice(2, 12);
        await bot.answerCallbackQuery(query.id);
        await axios.post(
          `${API_BASE}/clients/notify-admin`,
          { date },
          { timeout: 5000 }
        );
        return bot.sendMessage(chatId, `✅ ${date} sanasi tanlandi.`);
      }
      // Navigation (prev/next oy) — calendar o'zi handle qiladi
      return;
    }

    // --- Oddiy callback'lar ---
    await bot.answerCallbackQuery(query.id);

    // Admin bo'lsa callback ichidagi userId ishlatiladi, aks holda o'zini chatId'si
    const getTargetId = (callbackUserId) =>
      chatId === ADMIN_ID ? callbackUserId : chatId;

    // ================= LOAD =================
    if (data.startsWith("load_")) {
      const userId = data.split("_")[1];
      const targetId = getTargetId(userId);

      const res = await axios.get(`${API_BASE}/clients/${targetId}`, {
        timeout: 5000,
      });
      const user = res.data;

      if (!user) return bot.sendMessage(chatId, "❌ Foydalanuvchi topilmadi.");

      const latest = user.history?.at(-1);
      if (!latest)
        return bot.sendMessage(chatId, "📭 Servis tarixi mavjud emas.");

      if (chatId === ADMIN_ID) {
        const text =
          `Hurmatli ${user.name},\n\n` +
          `${user.carBrand} / ${user.carNumber}\n\n` +
          `Eslatib o'tamiz, siz ${latest.klameter} km yurganingizda moyni almashtirishingiz kerak.\n` +
          `Agar bu masofani bosib o'tmagan bo'lsangiz, moyni ${formatDate(latest.notificationDate)} sanada almashtirishingiz kerak.\n\n` +
          `Yaqin oradagi shoxobchamizga tashrif buyurishingizni so'rab qolamiz.`;

        return bot.sendMessage(chatId, text, {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 Ortga", callback_data: `back_${targetId}` }],
            ],
          },
        });
      }

      return bot.sendMessage(
        chatId,
        `📋 Eslatma:\n\n🚗 ${user.carBrand}\n🛢 ${latest.klameter} km\n📅 ${formatDate(latest.notificationDate)}`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔙 Ortga", callback_data: `back_${targetId}` }],
            ],
          },
        }
      );
    }

    // ================= CHECKLIST =================
    else if (data.startsWith("checklist_")) {
      const userId = data.split("_")[1];
      const targetId = getTargetId(userId);

      const res = await axios.get(`${API_BASE}/clients/${targetId}`, {
        timeout: 5000,
      });
      const user = res.data;

      if (!user) return bot.sendMessage(chatId, "❌ Foydalanuvchi topilmadi.");
      if (!user.history?.length)
        return bot.sendMessage(chatId, "📭 Servis tarixi mavjud emas.");

      const latest = user.history.at(-1);

      const text =
        `📋 Moy almashtirish tarixi\n\n` +
        `📅 ${formatDate(latest.notificationDate)}\n` +
        `🛢 ${latest.klameter} km\n` +
        `📨 ${latest.notified ? "✅ yuborilgan" : "⏳ yuborilmagan"}`;

      return bot.sendMessage(chatId, text, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 Ortga", callback_data: `back_${targetId}` }],
          ],
        },
      });
    }

    // ================= SEND (faqat admin) =================
    else if (data.startsWith("send_") && chatId === ADMIN_ID) {
      const userId = data.split("_")[1];

      const res = await axios.get(`${API_BASE}/clients/${userId}`, {
        timeout: 5000,
      });
      const user = res.data;

      const latest = user.history?.at(-1);
      if (!latest) return bot.sendMessage(chatId, "❌ Servis tarixi yo'q.");

      const text =
        `Hurmatli mijoz,\n\n` +
        `${user.carBrand} / ${user.carNumber}\n\n` +
        `Eslatib o'tamiz, siz ${latest.klameter} km yurganingizda moyni almashtirishingiz kerak.\n` +
        `Agar bu masofani bosib o'tmagan bo'lsangiz, moyni ${formatDate(latest.notificationDate)} sanada almashtirishingiz kerak.`;

      await bot.sendMessage(userId, text);
      return bot.sendMessage(chatId, "✅ Mijozga yuborildi!");
    }

    // ================= BALANCE =================
    else if (data.startsWith("balance_")) {
      const userId = data.split("_")[1];
      const targetId = getTargetId(userId);

      const res = await axios.get(`${API_BASE}/clients/${targetId}`, {
        timeout: 5000,
      });
      const user = res.data;

      if (!user) return bot.sendMessage(chatId, "❌ Foydalanuvchi topilmadi.");

      return bot.sendMessage(chatId, `💰 Balans: ${user.balance} so'm`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔙 Ortga", callback_data: `back_${targetId}` }],
          ],
        },
      });
    }

    // ================= BACK =================
    else if (data.startsWith("back_")) {
      const userId = data.split("_")[1];
      const targetId = getTargetId(userId);

      return bot.sendMessage(chatId, "Asosiy menyu:", {
        reply_markup: {
          inline_keyboard: userMenu(targetId).inline_keyboard,
        },
      });
    }
  } catch (err) {
    // AggregateError — bir nechta xatolar bir vaqtda
    if (err.name === "AggregateError" || Array.isArray(err.errors)) {
      console.error(
        "❌ AggregateError:",
        JSON.stringify(
          (err.errors || []).map((e) => e.message),
          null,
          2
        )
      );
    } else {
      console.error("❌ CALLBACK ERROR:", {
        message: err.message,
        status: err.response?.status,
        data: err.response?.data,
      });
    }

    try {
      await bot.sendMessage(chatId, "❌ Server bilan aloqa xatosi.");
    } catch (_) {}
  }
});

// ================= POLLING ERROR =================
bot.on("polling_error", (err) => {
  console.error("❌ POLLING ERROR:", err.message);
});

console.log("✅ Bot ishga tushdi...");