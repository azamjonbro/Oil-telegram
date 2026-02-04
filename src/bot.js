const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");

const token = "8008874583:AAEAgxCBg-_gRWRzcZsQJFkqzxsCpvbP1kM";
const bot = new TelegramBot(token, { polling: true });

// 🔴 MUHIM: agar bot VPSda bo‘lsa localhost ISHLAMAYDI
const API_BASE = "http://localhost:7766"; 
// const ADMIN_ID = 2043384301;
const ADMIN_ID = 4043384301;


// ================= UTILS =================
function formatDate(date) {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

// ================= MENUS =================
const userMenu = (userId) => ({
  inline_keyboard: [
    [
      { text: "📥 Moy almashtirish tarixi", callback_data: `load_${userId}` },
      { text: "📊 Balans", callback_data: `balance_${userId}` },
    ],
  ],
});

// ================= /START =================
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
        "⚠️ Server bilan bog‘lanib bo‘lmadi. Keyinroq urinib ko‘ring."
      );
    }
  }

  // ===== USER BOR =====
  if (user) {
    return bot.sendMessage(
      chatId,
      `👋 Xush kelibsiz, ${msg.from.first_name}!`,
      { reply_markup: userMenu(user._id) }
    );
  }

  // ===== USER YO‘Q → PHONE =====
  return bot.sendMessage(
    chatId,
    `Assalomu alaykum ${msg.from.first_name}!\n\n📱 Telefon raqamingizni yuboring:`,
    {
      reply_markup: {
        keyboard: [[{ text: "📞 Telefon raqamni yuborish", request_contact: true }]],
        resize_keyboard: true,
      },
    }
  );
});

// ================= CONTACT =================
bot.on("contact", async (msg) => {
  const chatId = msg.chat.id;

  if (chatId === ADMIN_ID) {
    return bot.sendMessage(chatId, "Admin foydalanuvchi sifatida ro‘yxatdan o‘tolmaydi.");
  }

  const phoneNumber = msg.contact.phone_number;

  try {
    const { data } = await axios.post(
      `${API_BASE}/clients/phone`,
      { phone: phoneNumber },
      { timeout: 5000 }
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
      }
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
    // ===== HISTORY =====
    if (data.startsWith("load_")) {
      const userId = data.split("_")[1];

      const res = await axios.get(`${API_BASE}/clients/history`, {
        params: { chatId },
      });

      const latest = res.data?.at(-1);
      if (!latest) {
        return bot.sendMessage(chatId, "📭 Hozircha tarix mavjud emas.");
      }

      return bot.sendMessage(
        chatId,
        `📋 Eslatma:\n\n🛢 ${latest.klameter} km da\n📅 ${formatDate(
          latest.nextChangeAt
        )}`,
        {
          reply_markup: {
            inline_keyboard: [[{ text: "🔙 Ortga", callback_data: `back_${userId}` }]],
          },
        }
      );
    }

    // ===== BALANCE =====
    if (data.startsWith("balance_")) {
      const userId = data.split("_")[1];

      const res = await axios.get(`${API_BASE}/clients/getballance`, {
        params: { chatId: chatId },
      });

      return bot.sendMessage(chatId, `💰 Balans: ${res.data.balance} so‘m`, {
        reply_markup: {
          inline_keyboard: [[{ text: "🔙 Ortga", callback_data: `back_${userId}` }]],
        },
      });
    }

    if (data.startsWith("back_")) {
      const userId = data.split("_")[1];
      return bot.sendMessage(chatId, "Asosiy menyu:", {
        reply_markup: userMenu(userId),
      });
    }
  } catch (err) {
    console.error("❌ CALLBACK error:", {
      data,
      status: err.response?.status,
      message: err.message,
    });

    bot.sendMessage(chatId, "❌ Ma'lumotni olishda xatolik.");
  }
});

// ================= ERRORS =================
bot.on("polling_error", (err) => {
  console.error("❌ POLLING:", err.message);
});

console.log("✅ Bot is running...");
