const {
	bot, 
	token, 
	telegramAPI, 
	channelId, 
	sequalize
} = require('./core.js');

const keyboard = require('./keyboard');

const kb = require('./keyboard-buttons');

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

	//подключение к базе данных
	try {
		await sequalize.authenticate();
		await sequalize.sync()
	} catch (e) {
		console.log('подключение к бд не удалось')
	}

	//начальный диалог при запуске бота
	bot.onText(/\/start/, (msg) => {

		let userId = msg.from.id;
		//проверка есть ли пользователь в базе данных
		UserModel.findOne({chatId: this.chatId}).then( (user) => {
		//если узнал, то предлагает меню в зависимости от прав

			if ( user.dataValues.isAdmin ) {
				let userAdmin = new UserAdmin(
					user.dataValues.firstName,
					user.dataValues.userName,
					user.dataValues.chatId
				);
				
				bot.sendMessage(userAdmin.getChatId(), `привет, ${userAdmin.getFirstName()}`, {
					reply_markup: {
						keyboard: keyboard.adminHome,
						resize_keyboard: true
					}
				}).then( ()=> {
					adminActions(userAdmin);
				} )
			}

		} ).catch( () => {
			//если не узнал, то проверяет подписан на канал или нет
			axios.post(`${telegramAPI}getChatMember`, {
				chat_id: channelId,
				user_id: userId
			}).then( response => {
				let userStatus;
				userStatus = response.data.result.status;
				createUser(msg, userStatus);
			} )
		} )
	});	

};

function adminActions(userAdmin) {
	
	bot.onText(/[а-яА-я]/, (msg) => {
		let message = msg.text;
		
		if ( userAdmin.getIsAdmin() ) {

			switch ( message ) {
				case kb.adminHome.loadPic: {
					bot.sendMessage(userAdmin.getChatId(), 'Отправь пикчи, проверь и подтверди');
					//функция загрузки фото
				} break;
				case kb.adminHome.info: {
					//фунция проверки статуса постинга
				} break;
				case kb.adminHome.startStopPosting: {
					//функция остановки, запуска постинга
				} break;
				case kb.adminHome.adminMembersPics: {
					//предложка
				} break;
			}

		}

	})

}

start();

	



