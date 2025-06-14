const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const token = '8166120153:AAGibaZcVD5FTbiNz--MkVZF6PvEAfBqP6s';
const bot = new TelegramBot(token, { polling: true });

let AdminID =231199271
// let AdminID = 2043384301

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
Hurmatli mijoz, sizning (${user.carBrand} / ${user.carNumber}) avtomobilingiz uchun moyni ${new Date(latestHistory.filledAt).toLocaleDateString()} sanada alishtirgan edingiz.

Eslatib o'tamizki siz ${latestHistory.klameter} km yurgan bo‘lsangiz avtomobilingiz moyini alishtirishingiz kerak. Agar siz shu masofani bosib o'tmagan bo'lsangiz ${new Date(latestHistory.nextChangeAt).toLocaleDateString()} sanada alishtirishingiz kerak, so'rab qolamizki, yaqin oradagi shaxobchamizga tashrif buyuring.

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
