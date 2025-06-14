const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const token = '8166120153:AAGibaZcVD5FTbiNz--MkVZF6PvEAfBqP6s';
const bot = new TelegramBot(token, { polling: true });

let AdminID =231199271
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
  if(chatId!==AdminID){
    bot.sendMessage(chatId,"Siz bu botda admin emassiz")
  }
  else{

    
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

// 📥 Yuklash tugmasi bosilganda
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
Hurmatli mijoz, sizning (${user.carBrand} / ${user.carNumber}) avtomobilingiz uchun moyni ${formatDate(latestHistory.filledAt)} sanada almashtirgan edingiz.

Eslatib o‘tamiz, siz ${latestHistory.klameter} km yurganingizda moyni almashtirishingiz kerak. Agar bu masofani bosib o‘tmagan bo‘lsangiz, moyni ${formatDate(latestHistory.nextChangeAt)} sanada almashtirishingiz kerak.

Yaqin oradagi shoxobchamizga tashrif buyurishingizni so‘rab qolamiz.

📞 Qo‘shimcha ma’lumot uchun bog‘lanish: +998913613619
`.trim();

        await bot.sendMessage(chatId, `📋 Nusxalash uchun xabar:\n\n${messageToClient}`);
      } catch (err) {
        console.error(err.message);
        await bot.sendMessage(chatId, "❌ Yuklashda xatolik yuz berdi.");
      }
    }
  }
});
