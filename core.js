const TelegramBot = require('node-telegram-bot-api');

const token = '5859407241:AAG66VfvBWGGzAt9yvawevtpSRM5CjuJjnk';

const bot = new TelegramBot(token, {
    webHook: {
        port:3000
    }
});

bot.setWebHook(`https://94.26.224.172/bot${token}`);

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