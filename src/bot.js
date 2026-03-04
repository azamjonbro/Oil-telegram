const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
require("dotenv").config();
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });


const API_BASE = "https://oil.techinfo.uz";
// const ADMIN_ID = 2043384301;
const ADMIN_ID = 231199271;

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
      { text: "📥 Moy almashtirish tarixi", callback_data: `checklist_${userId}` },
      { text: "📊 Balans", callback_data: `balance_${userId}` },
    ],
  ],
});


bot.onText(/\/start(?:\s+(.+))?/, async (msg) => {
  const chatId = msg.chat.id;

  // ===== ADMIN =====
  if (chatId === ADMIN_ID) {
    return bot.sendMessage(chatId, "⚙️ Admin panel:", {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🌐 Ilovani ochish",
              web_app: { url: "https://oilprojects.netlify.app/" },
            },
          ],
        ],
      },
    });
  }

  let user = null;

  try {
    const res = await axios.get(`${API_BASE}/clients/chatId`, {
      params: { id: chatId },
      timeout: 5000,
    });

    user = res.data;
  } catch (err) {
    if (err.response?.status !== 404) {
      console.error("❌ /start backend error:", {
        status: err.response?.status,
        data: err.response?.data,
        message: err.message,
      });

      return bot.sendMessage(
        chatId,
        "⚠️ Server bilan bog‘lanib bo‘lmadi. Keyinroq urinib ko‘ring.",
      );
    }
  }

  // ===== USER BOR =====
  if (user) {
    return bot.sendMessage(
      chatId,
      `👋 Xush kelibsiz, ${msg.from.first_name}!`,
      { reply_markup: userMenu(user._id) },
    );
  }

  // ===== USER YO‘Q → PHONE =====
  return bot.sendMessage(
    chatId,
    `Assalomu alaykum ${msg.from.first_name}!\n\n📱 Telefon raqamingizni yuboring:`,
    {
      reply_markup: {
        keyboard: [
          [{ text: "📞 Telefon raqamni yuborish", request_contact: true }],
        ],
        resize_keyboard: true,
      },
    },
  );
});

// ================= CONTACT =================
bot.on("contact", async (msg) => {
  const chatId = msg.chat.id;

  if (chatId === ADMIN_ID) {
    return bot.sendMessage(
      chatId,
      "Admin foydalanuvchi sifatida ro‘yxatdan o‘tolmaydi.",
    );
  }

  const phoneNumber = "+" + msg.contact.phone_number;
  console.log(phoneNumber);

  try {
    const { data } = await axios.post(
      `${API_BASE}/clients/phone`,
      { phone: phoneNumber },
      { timeout: 5000 },
    );

    if (!data?.exists) {
      return bot.sendMessage(chatId, "ℹ️ Siz bo‘yicha ma'lumot topilmadi.");
    }

    const user = data.user;

    await axios.put(`${API_BASE}/clients/chatId`, {
      chatId,
      userId: user._id,
    });

    return bot.sendMessage(
      chatId,
      `✅ Hurmatli ${user.name}, ro‘yxatdan o‘tish yakunlandi!`,
      {
        reply_markup: {
          remove_keyboard: true,
          inline_keyboard: userMenu(user._id).inline_keyboard,
        },
      },
    );
  } catch (err) {
    console.error("❌ CONTACT error:", {
      status: err.response?.status,
      data: err.response?.data,
      message: err.message,
    });

    bot.sendMessage(chatId, "❌ Ro‘yxatdan o‘tishda xatolik yuz berdi.");
  }
});

// ================= CALLBACKS =================
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  try {

    // helper — kimni ochamiz?
    const getTargetId = (callbackUserId) =>
      chatId === ADMIN_ID ? callbackUserId : chatId;

    // ================= LOAD =================
    if (data.startsWith("load_")) {
      const userId = data.split("_")[1];
      const targetId = getTargetId(userId);

      const res = await fetch(`${API_BASE}/clients/${targetId}`);
      const user = await res.json();

      if (!user)
        return bot.sendMessage(chatId, "❌ Foydalanuvchi topilmadi.");

      const latest = user.history?.at(-1);
      if (!latest)
        return bot.sendMessage(chatId, "📭 Servis tarixi mavjud emas.");

      // ADMIN preview
      if (chatId === ADMIN_ID) {
        const text = `Hurmatli ${user.name},

${user.carBrand} / ${user.carNumber}

Eslatib o‘tamiz, siz ${latest.klameter} km yurganingizda moyni almashtirishingiz kerak.
Agar bu masofani bosib o‘tmagan bo‘lsangiz, moyni ${formatDate(latest.notificationDate)} sanada almashtirishingiz kerak.

Yaqin oradagi shoxobchamizga tashrif buyurishingizni so‘rab qolamiz.`;

        return bot.sendMessage(chatId, text, {
          reply_markup: {
            inline_keyboard: [
              [{ text: "📨 Mijozga yuborish", callback_data: `send_${targetId}` }],
              [{ text: "🔙 Ortga", callback_data: `back_${targetId}` }],
            ],
          },
        });
      }

      // USER view
      return bot.sendMessage(
        chatId,
        `📋 Eslatma:

🚗 ${user.carBrand}
🛢 ${latest.klameter} km
📅 ${formatDate(latest.notificationDate)}`,
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

      const res = await fetch(`${API_BASE}/clients/${targetId}`);
      const user = await res.json();

      if (!user)
        return bot.sendMessage(chatId, "❌ Foydalanuvchi topilmadi.");

      if (!user.history?.length)
        return bot.sendMessage(chatId, "📭 Servis tarixi mavjud emas.");

      const latest = user.history.at(-1);

      const text = `📋 Moy almashtirish tarixi

📅 ${formatDate(latest.notificationDate)}
🛢 ${latest.klameter} km
📨 ${latest.notified ? "✅ yuborilgan" : "⏳ yuborilmagan"}`;

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

      const res = await fetch(`${API_BASE}/clients/${userId}`);
      const user = await res.json();

      const latest = user.history?.at(-1);
      if (!latest)
        return bot.sendMessage(chatId, "❌ Servis tarixi yo‘q.");

      const text = `Hurmatli mijoz,

${user.carBrand} / ${user.carNumber}

Eslatib o‘tamiz, siz ${latest.klameter} km yurganingizda moyni almashtirishingiz kerak.
Agar bu masofani bosib o‘tmagan bo‘lsangiz, moyni ${formatDate(latest.notificationDate)} sanada almashtirishingiz kerak.`;

      await bot.sendMessage(userId, text);
      return bot.sendMessage(chatId, "✅ Mijozga yuborildi!");
    }

    // ================= BALANCE =================
    else if (data.startsWith("balance_")) {
      const userId = data.split("_")[1];
      const targetId = getTargetId(userId);

      const res = await fetch(`${API_BASE}/clients/${targetId}`);
      const user = await res.json();

      return bot.sendMessage(chatId, `💰 Balans: ${user.balance} so‘m`, {
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
          inline_keyboard: [
            [
              { text: "📥 Moy almashtirish tarixi", callback_data: `checklist_${targetId}` },
              { text: "📊 Balans", callback_data: `balance_${targetId}` },
            ],
          ],
        },
      });
    }

  } catch (err) {
    console.error("❌ CALLBACK ERROR:", err);
    bot.sendMessage(chatId, "❌ Server bilan aloqa xatosi.");
  }
});



// ================= ERRORS =================
bot.on("polling_error", (err) => {
  console.error("❌ POLLING:", err.message);
});

console.log("✅ Bot is running...");
