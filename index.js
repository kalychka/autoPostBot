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

const path = require('path');

const download = require('download');

const {UserShema, PostShema, DownloadQueueShema, InfoShema, MemberPostShema} = require('./models');

const FormData = require('form-data');
const { query } = require('./db.js');
const { dirname } = require('path');

let onPosting, postingInterval;


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

//подключение к базе данных
async function connectToDB() {
	try {
		await sequalize.authenticate();
		await sequalize.sync()
		console.log('подклюен к бд');
	} catch (e) {
		console.log('подключение к бд не удалось')
	}
}

//стартовый диалог
async function start() {

	//начальный диалог при запуске бота
	bot.onText(/\/start/, (msg) => {
		//проверка есть ли пользователь в базе данных
		UserShema.findOne({
			where: {chatId: msg.chat.id}
		}).then( (user) => {

			if ( user instanceof UserShema ) {
					
				if ( user.isAdmin) {
					//отправка админского меню
					bot.sendMessage(user.chatId, `сап, ${user.firstName}`, {
						reply_markup: {
							keyboard: keyboard.adminHome,
							resize_keyboard: true
						}
					});
				} else {
					//отправка действий пользователя
					bot.sendMessage(user.chatId, `сап, ${user.firstName}\n отправь пикчи, которые хочешь предложить
					\nесли фото личное, то напиши об этом в описании фото: такие фото нужно постить по одному
					\nрандомпик можно отправлять альбомами`, {
						reply_markup: {
							keyboard: keyboard.userHome,
							resize_keyboard: true
						}
					});
				}
			} else {
				//если не узнал, то создает нового пользователя в БД
				createUser(msg);
			}

		} ).catch( (e) => {
			console.log(e);
		} )
	});

	//запуск админского диалога
	bot.onText(/[инфо|on/off постинг|предложка|интервал|предложка]/, adminActions);

	//запуск прослушки пикч в диалоге
	bot.on('photo', addDownloadQueue);

	//запуск прослушки подтверждения загрузки
	bot.onText(/[загрузить|удалить]/, savePostFromQueue); 

	//запись в логи бота
	updateInfo(120000, false, 'prnaddictionBot').then( (data) => {
		onPosting = data.onPosting;
		postingInterval = data.postingInterval;
		setInterval(autoPost, postingInterval);
	} );

	//запуск прослушки действий с постами в предложке
	bot.on('callback_query', memberPostsActions);

};

//обработка кнопок под постами в предложке
function memberPostsActions(query) {

	switch ( query.data ) {
		case 'block': {

			let chatId = query.message.chat.id;

			MemberPostShema.findAll({
				where: {
					workInChatId: chatId
				}
			}).then( posts => {

				posts.forEach( post => {
					bot.deleteMessage(chatId, post.messageId);

					fs.unlink(path.join(__dirname, '/membersPosts/') + post.name + '.jpg', (e) => {
						console.log(e);
						post.destroy();
						post.save();
					});
					
				} );

				UserShema.findOne({
					where: {
						chatId: posts[0].userChatId
					}
				}).then( member => {
					member.ban = true;
					member.save().then( () => {
						bot.answerCallbackQuery(query.id, `${member.firstName} заблокирован`);
					} )
				} )

			} )		
		} break;
		case 'deleteAll': {

			let chatId = query.message.chat.id;

			MemberPostShema.findAll({
				where: {
					workInChatId: chatId
				}
			}).then( posts => {

				posts.forEach( post => {
					bot.deleteMessage(chatId, post.messageId);

					fs.unlink(path.join(__dirname, '/membersPosts/') + post.name + '.jpg', (e) => {
						console.log(e);
						post.destroy();
						post.save();
					});
					
				} );
				bot.answerCallbackQuery(query.id, 'посты удалены');
			} )	

		} break;
		case 'delete': {

			let chatId = query.message.chat.id;
			let messageId = query.message.message_id;

			MemberPostShema.findOne({
				where: {
					messageId: messageId
				}
			}).then( (post) => {

				bot.deleteMessage(chatId, messageId);
				post.destroy();
				post.save();

				bot.answerCallbackQuery(query.id, 'пост удален');
			} )

		} break;
		case 'publish': {
			
			let chatId = query.message.chat.id;
			let messageId = query.message.message_id;

			MemberPostShema.findOne({
				where: {
					messageId: messageId
				}
			}).then( (post) => {

				createPostInDB(post.name, post.userChatId, post.authorUserName, PostShema);
				fs.rename( path.join(__dirname + '/membersPosts/') + post.name + '.jpg', path.join(__dirname + '/posts/') + post.name + '.jpg', () => {
					bot.deleteMessage(chatId, post.messageId);
					bot.answerCallbackQuery(query.id, 'добавлен в очередь постинга');
					post.destroy();
					post.save();
				} )
			} )
		} break;
	}

}

//функция автопостинга в канал
async function autoPost() {

	if (onPosting) {

		PostShema.findOne({
			order: [ [ 'ID' ]]
		}).then( (data) => {

			if ( data instanceof PostShema ) {
				let formData = new FormData();
				formData.append('chat_id', channelId);
				formData.append('photo', fs.createReadStream(path.join(__dirname, '/img/') + data.name + '.jpg'));
				//formData.append('caption', namesOfPics[0]);
	
				axios.post(`${telegramAPI}sendPhoto`, formData , {
					headers: {
						"Content-Type": "multipart/form-data; charset=UTF-8"
					}
				}).then( () => {
	
					fs.unlink(path.join(__dirname, '/posts/') + data.name + '.jpg', (err => {
						if (err) console.log(err);
					}) );
	
					data.destroy();
					
				} )
			} else {
				onPosting = false;
				updateInfo(postingInterval, false, 'prnaddictionBot');
			}
	
		} )

	}

}

//функция добавления пикч в очередь загрузки
async function addDownloadQueue(msg) {

	UserShema.findOne({
		where: {
			chatId: msg.chat.id
		}
	}).then( user => {

		if (  user.isAdmin ) {
			DownloadQueueShema.create({
				userChatId: user.chatId,
				name: msg.photo[ msg.photo.length - 1 ].file_id,
				isAdmin: true,
				messageId: msg.message_id
			});
		} else {
			DownloadQueueShema.create({
				userChatId: user.chatId,
				name: msg.photo[ msg.photo.length - 1 ].file_id,
				isAdmin: false,
				messageId: msg.message_id
			});
		}

	} )

}

//функция загрузки пикч из очереди
function savePostFromQueue(msg) {

	let namesOfDownloadPic = [];

	DownloadQueueShema.findAll({
		where: {
			userChatId: msg.chat.id
		}
	}).then( posts => {

		if (msg.text == 'загрузить') {
	
			posts.forEach(element => {

				let postData = {
					name: element.name,
					isAdmin: element.isAdmin,
				};

				if ( element.isAdmin ) {
					if (downloadPhoto(element, '/posts')) {
						namesOfDownloadPic.push(postData);
						element.destroy();
					}
				} else {
					if (downloadPhoto(element, '/membersPosts')) {
						namesOfDownloadPic.push(postData);
						element.destroy();
					}
				}
			});
			
			if ( namesOfDownloadPic.length > 0 ) {
							
				namesOfDownloadPic.forEach( item => {

					if ( item.isAdmin ) {
						createPostInDB(item.name, msg.chat.id, msg.from.first_name, PostShema);
					} else {
						createPostInDB(item.name, msg.chat.id, msg.from.first_name, MemberPostShema);
					}
	
				} )
	
				bot.sendMessage(msg.chat.id, `загружено ${namesOfDownloadPic.length}`, {
					reply_markup: {
						keyboard: keyboard.adminHome,
						resize_keyboard: true
					}
				}).then( () => namesOfDownloadPic = []);
	
	
			} else {
				bot.sendMessage(msg.chat.id, 'что-то пошло не так', {
					reply_markup: {
						keyboard: keyboard.adminHome,
						resize_keyboard: true
					}
				}).then( () => namesOfDownloadPic = [] );
			}
	
		} else if ( msg.text == 'удалить' ) {

			posts.forEach(element => {

				bot.deleteMessage(msg.chat.id, element.messageId);
				element.destroy()
			});
	
			bot.sendMessage(msg.chat.id, 'хорошо, выбери что-то другое', {
				reply_markup: {
					keyboard: keyboard.adminHome,
					resize_keyboard: true
				}
			}).then( () => namesOfDownloadPic = [] );
			
		}
	} )
}

//функция создание нового пользователя
async function createUser(msg) {

	let chatId = msg.chat.id;
	let firstName = msg.from.first_name;
	let userName = msg.from.username;

	axios.post(`${telegramAPI}getChatMember`, {
		chat_id: channelId,
		user_id: chatId
	}).then( response => {

		switch ( response.data.result.status ) {
		
			case 'creator':
			case 'administrator': {
				// создать сущность админа в бд
				let userAdmin = new UserAdmin(firstName, userName, chatId);
	
				UserShema.create({
					chatId: userAdmin.getChatId(),
					isAdmin: userAdmin.getIsAdmin(),
					firstName: userAdmin.getFirstName(),
					userName: userAdmin.getUserName()
				}).then( (res) => {
					bot.sendMessage(res.chatId, `привет, ${res.firstName}\nотправь пикчу, альбом или несколько альбомов\nлибо выбери пункт меню`, {
						reply_markup: {
							keyboard: keyboard.adminHome,
							resize_keyboard: true
						}
					});
				} );
			} break;
			case 'member': {
				// создать сущность подписчика в бд
				let user = new User(firstName, userName, chatId);
				UserShema.create({
					chatId: user.getChatId(),
					isAdmin: user.getIsAdmin(),
					firstName: user.getFirstName(),
					userName: user.getUserName()
				}).then( (res) => {
					bot.sendMessage(res.chatId, `привет, ${res.firstName}`, {
						reply_markup: {
							keyboard: keyboard.userHome,
							resize_keyboard: true
						}
					});
				} );
			} break;
			default: 
				bot.sendMessage(chatId, 'подпишись и продолжим:\n@prnaddiction');
			break;
		};
	} );



};

//меню админских действий
async function adminActions(msg) {

	UserShema.findOne({
		where: {chatId: msg.chat.id}
	}).then( (userAdmin) => {

		let message = msg.text;
	
		if ( userAdmin instanceof UserShema && userAdmin.isAdmin ) {

			switch ( message ) {
				case kb.adminHome.info: {
					getInfo(userAdmin);
				} break;
				case kb.adminHome.startStopPosting: {			
					onPosting ? onPosting = false : onPosting = true;
					updateInfo(postingInterval, onPosting, userAdmin.userName).then( (data) => {
						let autoPostingIs;
						data.onPosting ? autoPostingIs = 'запущен' : autoPostingIs = 'остановлен';
						bot.sendMessage(userAdmin.chatId, `авто постинг ${autoPostingIs}`);
					} )
				} break;
				case kb.adminHome.changeInterval: {
					changePostingInterval(userAdmin);
				} break;
				case kb.adminHome.adminMembersPics: {
					getPostsFromMembers(userAdmin);
				} break;
				case kb.adminBackMainMenu.mainMenu: {

					MemberPostShema.findAll({
						where: {
							workInChatId: userAdmin.chatId
						}
					}).then( posts => {
						
						posts.forEach( row => {

							bot.deleteMessage(userAdmin.chatId, row.messageId);
							row.messageId = null;
							row.workInChatId = null;
							row.save();

						} );
						
						bot.sendMessage(userAdmin.chatId, `предложка закрыта`, {
							reply_markup: {
								keyboard: keyboard.adminHome,
								resize_keyboard: true
							}
						})
					} )

				} break;
			}
		}

	} )
}

//получение постов из предложки
function getPostsFromMembers(userAdmin) {

	bot.sendMessage(userAdmin.chatId, `
		\nв предложку добавляются посты от пользователей по очереди
		\nесли они кончились - перезайди в предложку
	`, {
		reply_markup: {
			keyboard: keyboard.adminBackMainMenu,
			resize_keyboard: true
		}
	});

	MemberPostShema.findOne({
		order: [ [ 'ID' ]],
		where: {
			workInChatId: null
		}
	}).then( (post) => {

		if ( post instanceof MemberPostShema ) {
			MemberPostShema.findAll({
				where: {
					userChatId: post.userChatId,
					workInChatId: null
				}
			}).then( (elements) => {
	
				UserShema.findOne({
					where: {
						chatId: post.userChatId
					}
				}).then( (memberInfo) => {
					elements.forEach( (memberPost) => {
	
						bot.sendPhoto(userAdmin.chatId, path.join(__dirname, `/membersPosts/${memberPost.name}.jpg`), {
							headers: {
								"Content-Type": "multipart/form-data"
							},
							reply_markup: {
								inline_keyboard: [
									[
										{
											text: '✅',
											callback_data: 'publish',
											row_width: 1
										},
										{
											text: '🚫',
											callback_data: 'delete',
											row_width: 2
										},
									],
									[
										{
											text: 'B A N',
											callback_data: 'block',
		
										},
										{
											text: '🗑 all',
											callback_data: 'deleteAll'
										}
									]
								]
							},
							caption: `[👤 ${memberInfo.firstName}](https://t.me/${memberInfo.userName})`,
							parse_mode: 'MarkdownV2'
		
						}).then( (msg) => {
							memberPost.messageId = msg.message_id;
							memberPost.workInChatId = userAdmin.chatId;
							memberPost.save();
						} )
		
					} )
				} )
	
			} )
		} else {
			bot.sendMessage(userAdmin.chatId, 'предложка пуста', {
				reply_markup: {
					keyboard: keyboard.adminHome,
					resize_keyboard: true
				}
			})
		}

	} )

}

//изменяет интервал постинга
function changePostingInterval(userAdmin) {

	bot.sendMessage(userAdmin.chatId, 'введи новый интервал постинга в минутах, жду').then( () => {
		bot.onText(/[1-9]/, (msg) => {
			bot.removeTextListener(/[1-9]/);

			if ( msg.text != 0 ) {

				updateInfo(msg.text, onPosting, userAdmin.userName).then( (data) => {

					if ( data instanceof InfoShema) {

						bot.sendMessage(userAdmin.chatId, `интервал изменен: ${data.postingInterval} мин
						\nпользователь: @${data.userName}`);

					}

				} )

			}

		})
	} )

}

//сохраняет пикчи на диск
async function downloadPhoto(element, folder) {

	return (
		axios.post(`${telegramAPI}getFile`, {
			file_id: element.name
		}).then( (file) => {
	
			let filePath = file.data.result.file_path;
			let fileName = file.data.result.file_id;
	
			let downloadLink = `https://api.telegram.org/file/bot` + `${token}` + `/${filePath}`;
	
			return (
				download(downloadLink, path.join(__dirname, folder), {filename: `${fileName}.jpg`}).then( () => {

					return true;
				})
			)

		})
	)
	
}

//добавляет запись с постом в очередь постинга либо в предложку
async function createPostInDB(name, chatId, authorUserName, Shema) {

	await Shema.create({
		name: name,
		userChatId: chatId,
		authorUserName: authorUserName
	})
}

//постит информацию о боте
async function getInfo(userAdmin) {

	InfoShema.findOne({
		order: [ [ 'ID', 'DESC' ]]
	}).then( data => {
		
		updateInfo(data.postingInterval, data.onPosting, userAdmin.userName).then( (newData) => {
			
			bot.sendMessage(userAdmin.chatId, 
			`постинг: ${ newData.onPosting ? 'исполняется' : 'остановлен'}
			\nколичество постов в архиве: ${newData.countOfPost}
			\nинтервал постинга: ${(newData.postingInterval / 60000).toFixed(2)} мин
			\nпримерное время постинга: ${newData.estimatedPostingTime}`);

		} )
	})

}

//записывает инфу о боте в БД
async function updateInfo(postingInterval, onPosting, userName) {

	let countOfPost = await PostShema.count();
	let estimatedPostingTime;

	//примерное время постинга, учитывая кол-во постов

	//подсчет в минутах
	estimatedPostingTime = ((postingInterval / 60000) * countOfPost).toFixed(2);

	if ( estimatedPostingTime >= 60 ) {
		let hours = Math.trunc(estimatedPostingTime/60);
		let minutes = estimatedPostingTime % 60;

		estimatedPostingTime = `${hours} ч. ${minutes} м.`;

	} else {
		estimatedPostingTime = estimatedPostingTime + ' мин';
	}
	
	return (
		InfoShema.create({
			countOfPost: countOfPost,
			postingInterval: postingInterval,
			estimatedPostingTime: estimatedPostingTime,
			onPosting: onPosting,
			userName: userName
		})
	)
}

//подключение к БД, если успешно => старт начального диалога
connectToDB().then( () =>  start());






	



