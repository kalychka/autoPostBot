const TelegramBot = require('node-telegram-bot-api');

const token = '5859407241:AAG66VfvBWGGzAt9yvawevtpSRM5CjuJjnk';

const bot = new TelegramBot(token, {
    webHook: {
        port:3000
    }
});

bot.setWebHook(`https://3c6b-178-46-110-167.eu.ngrok.io/bot${token}`);

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