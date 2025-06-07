const TelegramBot = require('node-telegram-bot-api');
const fetch = require('node-fetch'); // Eslatma: Agar Node.js versiyangiz 18 dan past bo‘lsa, `node-fetch`ni alohida o‘rnating
const token = '8166120153:AAGibaZcVD5FTbiNz--MkVZF6PvEAfBqP6s';
const bot = new TelegramBot(token, { polling: true });

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

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
});

// 📥 Yuklash tugmasi bosilganda
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

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
Hurmatli mijoz, sizning avtomobilingiz (${user.carBrand} / ${user.carNumber}) uchun moyni ${user.filledAt.toLocaleDateString()} sanada quygan edingiz.

Eslatib o'tamizki agar siz ${user.klameter} km yurgan bo‘lsangiz yoki ${new Date(user.nextChangeAt).toLocaleDateString()} sanasiga yetgan bo‘lsangiz, iltimos, yaqin oradagi shaxobchamizga tashrif buyuring.

📞 Qo‘shimcha ma’lumot uchun bog‘lanish: +998913613619
      `.trim();

      await bot.sendMessage(chatId, `📋 Nusxalash uchun xabar:\n\n${messageToClient}`);
    } catch (err) {
      await bot.sendMessage(chatId, "❌ Yuklashda xatolik yuz berdi.");
    }
  }
});
