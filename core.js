const TelegramBot = require('node-telegram-bot-api');

const token = '5859407241:AAG66VfvBWGGzAt9yvawevtpSRM5CjuJjnk';

const bot = new TelegramBot(token, {
    webHook: {
        port: 80
    }
    //polling: true
});

bot.setWebHook(`https://89.248.207.100/bot${token}`);

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
