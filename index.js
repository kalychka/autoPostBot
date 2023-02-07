const {bot, token, telegramAPI, channelId} = require('./core.js');

const axios = require('axios');

const fs = require('fs');

class User {

	isAdmin = false;
	firstName;
	userName;
	chatId;

	constructor(firstName,userName,chatId) {
		this.firstName = firstName;
		this.userName = userName;
		this.chatId = chatId;
	}

}

class UserAdmin extends User {

	isAdmin = true;

	constructor(firstName,userName,chatId) {
		super(firstName,userName,chatId);
	}
	

}

function createUser(msg) {

	let chatId = msg.chat.id;
	let userId = msg.from.id;
	let firstName = msg.from.first_name;
	let userName = msg.from.username;
	let userStatus;

	axios.post(`${telegramAPI}getChatMember`, {
		chat_id: channelId,
		user_id: userId
	}).then( response => {
		userStatus = response.data.result.status;

		switch ( userStatus ) {
			case 'creator':
			case 'administrator': {
				// создать сущность админа в бд
				
			} break;
			case 'member': {
				// создать сущность подписчика в бд
			} break;
			default: {
				bot.sendMessage(chatId, 'подпишись и продолжим:\n@prnaddiction');
			}
		};
	} )

	


}


//начальный диалог при запуске бота
bot.onText(/\/start/, (msg) => {

	createUser(msg);

});		



