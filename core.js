const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

const token = process.env.BOT_TOKEN;

const channelId = process.env.CHANNEL_NAME;

const bot = new TelegramBot(token, {
    // webHook: {
    //     url: 'https://prnaddiction.ru',
    //     port: 3000,
    //     host: 'localhost'
    // }
    polling: true
});

// bot.setWebHook(`https://prnaddiction.ru/autoPostBot/core.js/${token}`, {
//     certificate: '/etc/ssl/prnaddiction.crt'
// });

const telegramAPI = `https://api.telegram.org/bot${token}/`;

const sequalize = require('./db');

module.exports = {
    bot,
    telegramAPI,
    token,
    channelId,
    sequalize
}
