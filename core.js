const TelegramBot = require('node-telegram-bot-api');

const token = '5859407241:AAG66VfvBWGGzAt9yvawevtpSRM5CjuJjnk';

const bot = new TelegramBot(token, {
    webHook: {
        port:80
    }
});

bot.setWebHook(`https://d545-31-162-127-181.eu.ngrok.io/bot${token}`);

const telegramAPI = `https://api.telegram.org/bot${token}/`;

const channelId = '@whorebotplace';

const sequalize = require('./db');

module.exports = {
    bot,
    telegramAPI,
    token,
    channelId,
    sequalize
}