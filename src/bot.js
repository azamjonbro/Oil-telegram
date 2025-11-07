const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");

const token = "8166120153:AAGibaZcVD5FTbiNz--MkVZF6PvEAfBqP6s";
const bot = new TelegramBot(token, { polling: true });

const ADMIN_ID = 231199271;
const API_BASE = "http://localhost:7766";

function formatDate(date) {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

// 🔹 Asosiy menyu
const userMenu = (userId) => ({
  inline_keyboard: [
    [
      { text: "📥 Moy almashtirish tarixi", callback_data: `load_${userId}` },
      { text: "🚘 Avtoulov ma’lumotlari", callback_data: `info_${userId}` },
    ],
    [
      { text: "📊 Balansni ko‘rish", callback_data: `balance_${userId}` },
      { text: "➕ Hisobni to‘ldirish", callback_data: `topup_${userId}` },
    ],
  ],
});

// 🔹 START komandasi
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  if (chatId === ADMIN_ID) {
    return bot.sendMessage(chatId, "⚙️ Moy almashtirish ilovasi:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🌐 Ilovani ochish", web_app: { url: "https://oilprojects.netlify.app/" } }],
        ],
      },
    });
  }

  try {
    const { data: user } = await axios.get(`${API_BASE}/clients/chatId`, {
      params: { id: chatId },
    });

    if (user) {
      return bot.sendMessage(
        chatId,
        `👋 Xush kelibsiz, ${msg.from.first_name}!\n\nSiz allaqachon ro'yxatdan o'tgansiz. Quyidagi menyudan tanlang:`,
        { reply_markup: userMenu(user._id) }
      );
    }

    bot.sendMessage(
      chatId,
      `Assalomu alaykum ${msg.from.first_name}!\n\n📱 Iltimos, telefon raqamingizni yuboring:`,
      {
        reply_markup: {
          keyboard: [[{ text: "📞 Telefon raqamni yuborish", request_contact: true }]],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      }
    );
  } catch (err) {
    console.error("❌ /start error:", err.message);
    bot.sendMessage(chatId, "Xatolik yuz berdi. Iltimos, keyinroq urinib ko‘ring.");
  }
});

// 📱 Telefon raqamni qabul qilish
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const phoneNumber =
    msg.contact?.phone_number ||
    (msg.text?.match(/^\+?998\d{9}$/) ? msg.text.trim() : null);
  if (!phoneNumber) return;

  if (chatId === ADMIN_ID) {
    return bot.sendMessage(chatId, "Siz admin hisobidasiz, foydalanuvchi sifatida ro‘yxatdan o‘tolmaysiz.");
  }

  try {
    const { data } = await axios.post("https://oil.techinfo.uz/clients/phone", { phone: phoneNumber });

    if (!data.exists) {
      return bot.sendMessage(chatId, "ℹ️ Ma'lumot topilmadi. Admin bilan bog‘laning.");
    }

    const user = data.user;
    await axios.put(`${API_BASE}/clients/chatId`, { chatId, userId: user._id });

    bot.sendMessage(
      chatId,
      `✅ Hurmatli ${user.name}, siz muvaffaqiyatli ro‘yxatdan o‘tdingiz!`,
      { reply_markup: userMenu(user._id) }
    );
  } catch (err) {
    console.error("❌ Phone handling error:", err.message);
    bot.sendMessage(chatId, "Xatolik yuz berdi. Iltimos, qayta urinib ko‘ring.");
  }
});

// 🔸 CALLBACK HANDLER
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  try {
    // 📋 Moy tarixi
    if (data.startsWith("load_")) {
      const userId = data.split("_")[1];
      const { data: user } = await axios.get(`https://safonon.uz/clients/${userId}`);
      const latest = user.history.at(-1);

      const msg = `📋 Eslatma:\n\nSiz ${latest.klameter} km yurganingizda moyni almashtirishingiz kerak.\nYoki ${formatDate(
        latest.nextChangeAt
      )} sanada almashtiring.`;

      return bot.sendMessage(chatId, msg, {
        reply_markup: { inline_keyboard: [[{ text: "🔙 Ortga", callback_data: `back_${userId}` }]] },
      });
    }

    // 🚘 Avtomobil ma’lumotlari
    if (data.startsWith("info_")) {
      const userId = data.split("_")[1];
      const { data: user } = await axios.get(`https://safonon.uz/clients/${userId}`);

      const info = `🚗 Avtomobil ma’lumotlari:\n\nMarka: ${user.car.brand}\nModel: ${user.car.model}\nRaqam: ${user.car.number}`;
      return bot.sendMessage(chatId, info, {
        reply_markup: { inline_keyboard: [[{ text: "🔙 Ortga", callback_data: `back_${userId}` }]] },
      });
    }

    // 💰 Balans
    if (data.startsWith("balance_")) {
      const userId = data.split("_")[1];
      const param = await axios.get(`${API_BASE}/clients/getballance`, { params: { id: chatId } });

      return bot.sendMessage(chatId, `💰 Joriy balansingiz: ${param.data.balance} so‘m`, {
        reply_markup: { inline_keyboard: [[{ text: "🔙 Ortga", callback_data: `back_${userId}` }]] },
      });
    }

    // 💳 Hisobni to‘ldirish
    if (data.startsWith("topup_")) {
      const userId = data.split("_")[1];
      return bot.sendMessage(
        chatId,
        `💳 Hisobni to‘ldirish uchun quyidagi havoladan foydalaning:\nhttps://safonon.uz/pay/${userId}`,
        {
          reply_markup: { inline_keyboard: [[{ text: "🔙 Ortga", callback_data: `back_${userId}` }]] },
        }
      );
    }

    // 🔙 Ortga qaytish
    if (data.startsWith("back_")) {
      const userId = data.split("_")[1];
      return bot.sendMessage(
        chatId,
        "🔙 Asosiy menyuga qaytdingiz. Quyidagilardan birini tanlang:",
        { reply_markup: userMenu(userId) }
      );
    }

    // Default javob
    bot.sendMessage(chatId, `ℹ️ Siz tanlagan tugma: ${data}`);
  } catch (err) {
    console.error(`❌ Callback (${data}) error:`, err.message);
    bot.sendMessage(chatId, "❌ Ma’lumotni olishda xatolik yuz berdi.");
  }
});

console.log("✅ Bot is running...");
