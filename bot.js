const TelegramBot = require('node-telegram-bot-api');
const token = '7179751378:AAGKQ0vgurJjjzBVsHiybs1PMcuu5PbYMGA';
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
