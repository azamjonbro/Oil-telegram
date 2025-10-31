const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const token = '8166120153:AAGibaZcVD5FTbiNz--MkVZF6PvEAfBqP6s';
const bot = new TelegramBot(token, { polling: true });

let AdminID = 231199271
// let AdminID = 2043384301


function formatDate(date) {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}


bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  if (chatId !== AdminID) {
    bot.sendMessage(chatId, `Assalomu alaykum ${msg.from.first_name}!\n\nUshbu bot orqali siz avtomobilingiz moy almashtirish eslatmalarini olishingiz mumkin.
      
      \n iltimos telefon raqamingizni yuboring`, {
      reply_markup: {
        keyboard: [
          [
            {
              text: "Telefon raqamni yuborish",
              request_contact: true,
            },
          ],
        ],
        resize_keyboard: true,
        one_time_keyboard: true,
      }
    });
  }
  else {


    bot.sendMessage(chatId, 'Moy almashtirish eslatma ilovasini oching:', {
      reply_markup: {
        inline_keyboard: [[
          {
            text: 'Ilovani ochish',
            web_app: { url: 'https://oilprojects.netlify.app/' }
          }
        ]]
      }
    });
  }
});

// contact yoki oddiy raqam yozish holatlarini birlashtiramiz
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  let phoneNumber;

  // 1️⃣ Agar foydalanuvchi contact yuborgan bo‘lsa
  if (msg.contact && msg.contact.phone_number) {
    phoneNumber = msg.contact.phone_number;
  }

  // 2️⃣ Agar foydalanuvchi raqamni matn sifatida yozgan bo‘lsa
  else if (msg.text && msg.text.match(/^\+?998\d{9}$/)) {
    phoneNumber = msg.text.trim();
  }

  // 3️⃣ Agar raqam topilmasa — chiqamiz
  if (!phoneNumber) return;

  // 4️⃣ Adminni tekshiramiz (AdminID ni o‘zingdagi o‘zgaruvchidan olasan)
  if (chatId === AdminID) {
    return bot.sendMessage(chatId, "Siz bu botda admin emassiz");
  }

  // 5️⃣ Serverga so‘rov yuboramiz
  try {
    const response = await axios.post('http://localhost:7766/clients/phone', {
      phone: phoneNumber
    });

    const user = response.data;
    console.log(user);

    if (user.exists) {
      bot.sendMessage(
        chatId,

        `✅ Sizning ma'lumotlaringiz topildi, hurmatli ${user.user.name} ${user.phone}!\n\nSizga moy almashtirish eslatmalari yuboriladi.`,
        {
          reply_markup: {
            keyboard: [
                [
                  {
                    text: "📥 Moy almashtirish tarixini yuklash",
                    callback_data: `load_${user.user._id}`,
                  },
                  {
                    text: "Mening avtoulovim haqida ma'lumot",
                    callback_data: `info_${user.user._id}`,
                  },
                ],
                [
                  {
                    text: "🔄 Avtoulov ma'lumotlarini yangilash",
                    callback_data: `update_${user.user._id}`,
                  },
                  {
                    text: "📊 Balansni ko'rish",
                    callback_data: `balance_${user.user._id}`,
                  }
                ]

            ]
            ,            resize_keyboard: true,
            one_time_keyboard: true,
          },
        }
      );
    } else {
      bot.sendMessage(
        chatId,
        "ℹ️ Kechirasiz, sizning ma'lumotlaringiz topilmadi. Iltimos, avtoulov markasi va modelini qo'shish uchun admin bilan bog'laning."
      );
    }
  } catch (err) {
    console.error(err.message);
    console.error("ERROR >>>", err.response?.data || err.message || err);
    bot.sendMessage(chatId, "❌ Xatolik yuz berdi. Iltimos, qayta urinib ko'ring.");
  }
});


bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  if (chatId !== AdminID) {
    bot.sendMessage(chatId, "Siz bu botda admin emassiz");
  } else {
    if (data.startsWith("load_")) {
      const userId = data.replace("load_", "");

      try {
        const response = await axios.get(`https://safonon.uz/clients/${userId}`);
        const user = response.data;

        const latestHistory = user.history[user.history.length - 1];

        const messageToClient = `
Hurmatli mijoz,

Eslatib o‘tamiz, siz ${latestHistory.klameter} km yurganingizda moyni almashtirishingiz kerak. Agar bu masofani bosib o‘tmagan bo‘lsangiz, moyni ${formatDate(latestHistory.nextChangeAt)} sanada almashtirishingiz kerak.

Yaqin oradagi shoxobchamizga tashrif buyurishingizni so‘rab qolamiz.
`.trim();

        await bot.sendMessage(chatId, messageToClient);
      } catch (err) {
        console.error(err.message);
        await bot.sendMessage(chatId, "❌ Yuklashda xatolik yuz berdi.");
      }
    }
  }
});
