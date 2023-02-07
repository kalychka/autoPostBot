const TelegramBot = require('node-telegram-bot-api');

const token = '5859407241:AAG66VfvBWGGzAt9yvawevtpSRM5CjuJjnk';

const bot = new TelegramBot(token, {polling: true});

const telegramAPI = `https://api.telegram.org/bot${token}/`;

const channelId = '@whorebotplace';

module.exports = {
    bot,
    telegramAPI,
    token,
    channelId
}