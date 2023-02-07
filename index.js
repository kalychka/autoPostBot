const {
	bot, 
	token, 
	telegramAPI, 
	channelId, 
	sequalize
} = require('./core.js');

const axios = require('axios');

const fs = require('fs');

const UserModel = require('./models');

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

	getIsAdmin() {
		return this.isAdmin;
	}

	getFirstName() {
		return this.firstName;
	}

	getUserName() {
		return this.userName;
	}

	getChatId() {
		return this.chatId;
	}

}

class UserAdmin extends User {

	isAdmin = true;

	constructor(firstName,userName,chatId) {
		super(firstName,userName,chatId);
	}
	
}

async function createUser(msg, userStatus) {

	let chatId = msg.chat.id;
	
	let firstName = msg.from.first_name;
	let userName = msg.from.username;
	
	switch ( userStatus ) {
		case 'creator':
		case 'administrator': {
			// создать сущность админа в бд
			let userAdmin = new UserAdmin(firstName, userName, chatId);
			await UserModel.create({
				chatId: userAdmin.getChatId(),
				isAdmin: userAdmin.getIsAdmin(),
				firstName: userAdmin.getFirstName(),
				userName: userAdmin.getUserName()
			});
		} break;
		case 'member': {
			// создать сущность подписчика в бд
			let user = new UserAdmin(firstName, userName, chatId);
			await UserModel.create({
				chatId: user.getChatId(),
				isAdmin: user.getIsAdmin(),
				firstName: user.getFirstName(),
				userName: user.getUserName()
			});
		} break;
		default: {
			bot.sendMessage(chatId, 'подпишись и продолжим:\n@prnaddiction');
		}
	};

};

const start = async () => {

	try {
		await sequalize.authenticate();
		await sequalize.sync()
	} catch (e) {
		console.log('подключение к бд не удалось')
	}

	//начальный диалог при запуске бота
	bot.onText(/\/start/, (msg) => {

		let userId = msg.from.id;

		axios.post(`${telegramAPI}getChatMember`, {
			chat_id: channelId,
			user_id: userId
		}).then( response => {
			let userStatus;
			userStatus = response.data.result.status;
			createUser(msg, userStatus);
		} )

		

	});	

}

start();

	



