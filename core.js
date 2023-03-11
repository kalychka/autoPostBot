const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

const token = process.env.BOT_TOKEN;

const channelId = process.env.CHANNEL_NAME;

const bot = new TelegramBot(token, {
    webHook: {
        port: 3000
    }
    //polling: true
});

bot.setWebHook(`https://prnaddiction.ru/index.js`, {
    certificate: '/etc/ssl/prnaddiction.crt'
});

const telegramAPI = `https://api.telegram.org/bot${token}/`;

const sequalize = require('./db');

module.exports = {
    bot,
    telegramAPI,
    token,
    channelId,
    sequalize
}
