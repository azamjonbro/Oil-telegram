const TelegramBot = require('node-telegram-bot-api');
const fetch = require('node-fetch'); // Eslatma: Agar Node.js versiyangiz 18 dan past bo‘lsa, `node-fetch`ni alohida o‘rnating
const token = '8166120153:AAGibaZcVD5FTbiNz--MkVZF6PvEAfBqP6s';
const bot = new TelegramBot(token, { polling: true });

let AdminID =2043384301

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
if(chatId!==AdminID){
    bot.sendMessage(chatId,"Siz bu botda admin emassiz")
  }
  else{

    if (data.startsWith("load_")) {
      const userId = data.replace("load_", "");
      
    try {
      const response = await fetch(`http://localhost:5000/clients/${userId}`);
      
      if (!response.ok) {
        throw new Error("Ma'lumotlarni olishda xatolik.");
      }
      
      const user = await response.json();
      
      // 📝 Mijozga yuboriladigan matnni tayyorlash
      const messageToClient = `
      Hurmatli mijoz, sizning  (${user.carBrand} / ${user.carNumber}) avtomobilingiz uchun moyni ${new Date(user.history[user.history.length-1].filledAt).toLocaleDateString()} sanada alishtirgan edingiz.
      
      Eslatib o'tamizki siz ${user.history[user.history.length-1].klameter} km yurgan bo‘lsangiz avtomobilingiz moyini alishtirishingiz kerak. Agar siz shu masofani bosib o'tmagan bo'lsangiz  ${new Date(user.history[user.history.length-1].nextChangeAt).toLocaleDateString()} sanada alishtirishingiz kerak, iltimos, yaqin oradagi shaxobchamizga tashrif buyuring.
      
      📞 Qo‘shimcha ma’lumot uchun bog‘lanish: +998913613619
      `.trim();
      
      await bot.sendMessage(chatId, `📋 Nusxalash uchun xabar:\n\n${messageToClient}`);
    } catch (err) {
      console.log(err.message);
      
      await bot.sendMessage(chatId, "❌ Yuklashda xatolik yuz berdi.");
    }
  }
}
});
