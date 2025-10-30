const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const token = '8166120153:AAGibaZcVD5FTbiNz--MkVZF6PvEAfBqP6s';
const bot = new TelegramBot(token, { polling: true });

// let AdminID =231199271
let AdminID = 2043384301


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
