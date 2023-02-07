const {bot, token, telegramAPI, channelId} = require('./core.js');

const axios = require('axios');

const fs = require('fs');


//начальный диалог при запуске бота
bot.onText(/\/start/, (msg) => {
	getUserStatus(msg.from.id).then( userStatus => {
		switch ( userStatus ) {
			case 'creator':
			case 'administrator': {
				axios.post(`${telegramAPI}sendMessage`, {
					chat_id: helper.getChatId(msg),
					text: `привет, ${msg.from.first_name}, выбери что тебя интересует:\nиспользуй клавиатурные кнопки`,
					reply_markup: {
						keyboard: keyboard.adminHome,
						resize_keyboard: true			
					}
				})//.then( (msg) => adminActions());
			} break;
			case 'member': {
				axios.post(`${telegramAPI}sendMessage`, {
					chat_id: helper.getChatId(msg),
					text: `привет, ${msg.from.first_name}, выбери вариант пикч,\nкоторые хочешь сейчас предложить`,
					reply_markup: {
						keyboard: keyboard.member,
						resize_keyboard: true			
					}
				})
			} break;
			case 'left': {
				axios.post(`${telegramAPI}sendMessage`, {
					chat_id: helper.getChatId(msg),
					text: 'ты не подписан на канал: \nhttps://t.me/prnaddiction \nподпишись, чтобы отрпавить пикчи в предложку',
				})
			} break;
		}
	} )
});		


