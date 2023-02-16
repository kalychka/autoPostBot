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

let onPosting, postingInterval, postingTimerID;


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

					if ( user.ban ) {
						bot.sendMessage(user.chatId, 'отправка пикч ограничена');
					} else {
						//отправка действий пользователя
						bot.sendMessage(user.chatId, `\nсап, ${user.firstName}\nотправь пикчи, которые хочешь предложить`);
					}
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
	bot.onText(/[инфо|on/off постинг|предложка|интервал|предложка|еще]/, adminActions);

	//запуск прослушки пикч в диалоге
	bot.on('photo', addDownloadQueue);

	//запись в логи бота
	updateInfo(1000, false, 'prnaddictionBot').then( (data) => {
		onPosting = data.onPosting;
		postingInterval = data.postingInterval;
	} );

	//запуск прослушки действий с постами в предложке
	bot.on('callback_query', memberPostsActions);

	//запуск прослушки действий с постами при загрузке
	bot.on('callback_query', savePostFromQueue);

};

//обработка кнопок под постами в предложке
function memberPostsActions(query) {

	switch ( query.data ) {
		case 'blockMemberPost': {

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
		case 'deleteAllMemberPost': {

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
		case 'deleteMemberPost': {

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
		case 'publishMemberPost': {
			
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

	console.log('Posting ON, postingInterval: ', postingInterval);

	//if (onPosting) {

		

		// PostShema.findOne({
		// 	order: [ [ 'ID' ]]
		// }).then( (data) => {

		// 	if ( data instanceof PostShema ) {
		// 		let formData = new FormData();
		// 		formData.append('chat_id', channelId);
		// 		formData.append('photo', fs.createReadStream(path.join(__dirname, '/posts/') + data.name + '.jpg'));
		// 		//formData.append('caption', namesOfPics[0]);
	
		// 		axios.post(`${telegramAPI}sendPhoto`, formData , {
		// 			headers: {
		// 				"Content-Type": "multipart/form-data; charset=UTF-8"
		// 			}
		// 		}).then( () => {
	
		// 			fs.unlink(path.join(__dirname, '/posts/') + data.name + '.jpg', (err => {
		// 				if (err) console.log(err);
		// 			}) );
	
		// 			data.destroy();
					
		// 		} )
		// 	} else {
		// 		onPosting = false;
		// 		updateInfo(postingInterval, false, 'prnaddictionBot');
		// 	}
	
		// } )

	//}
	
}

//функция добавления пикч в очередь загрузки
async function addDownloadQueue(msg) {

	let fileName = msg.photo[ msg.photo.length - 1 ].file_id;

	UserShema.findOne({
		where: {
			chatId: msg.chat.id
		}
	}).then( user => {

		if ( user instanceof UserShema ) {
			if (  !user.ban ) {
				DownloadQueueShema.create({
					userChatId: user.chatId,
					name: fileName,
					isAdmin: user.isAdmin
				}).then( (data) => {
					if (data instanceof DownloadQueueShema) {
						
						let formData = new FormData();
						let uploadKeyboard = {
							inline_keyboard: [
								[
									{
										text: '✅',
										callback_data: 'confirmPost'
									},
									{
										text: '🚫',
										callback_data: 'deletePost'
									},
								],
								[
									{
										text: '🔥',
										callback_data: 'confirmAsExclusivePost',
	
									},
									{
										text: '🗑 all',
										callback_data: 'deleteAllPost'
									}
								]
							]
						}
						formData.append('chat_id', user.chatId);
						formData.append('photo',  data.name);
						formData.append('reply_markup', JSON.stringify(uploadKeyboard));
						formData.append('caption', `\n✅ - загрузить, 🚫 - удалить
						\n🔥 - загрузить как личное фото,
						\n🗑 all - удалить все фото`);
	
						axios.post(`${telegramAPI}sendPhoto`, formData, {
							headers: {
								"Content-Type": "multipart/form-data; charset=UTF-8"
							}
						}).then( (res) => {
							data.name = res.data.result.photo[ res.data.result.photo.length - 1 ].file_id;
							
							data.messageId = res.data.result.message_id;
							data.save();
							bot.deleteMessage(user.chatId, msg.message_id);
						} )
	
						
					}
				} )
			} else {
				bot.sendMessage(msg.chat.id, 'отправка сообщений ограничена');
			}
		}

	} )
}

//обработка действий с постом при загрузке
function savePostFromQueue(query) {

	switch (query.data) {
		case 'confirmPost': {

			let chatId = query.message.chat.id;
			let messageId = query.message.message_id;

			DownloadQueueShema.findOne({
				where: {
					userChatId: chatId,
					messageId: messageId
				}
			}).then( data => {

				if (data instanceof DownloadQueueShema) {

					UserShema.findOne({
						where: {
							chatId: data.userChatId
						}
					}).then( authorPost => {

						if ( authorPost.isAdmin ) {
							downloadPhoto(data, '/posts').then( () => {
								createPostInDB(data.name, data.userChatId, authorPost.userName, PostShema);
							} );
						} else {
							downloadPhoto(data, '/membersPosts').then( () => {
								createPostInDB(data.name, data.userChatId, authorPost.userName, MemberPostShema);
							} );
						}
						bot.deleteMessage(chatId, data.messageId);
						bot.answerCallbackQuery(query.id, '💾 пост сохранен >8');
						data.destroy();
						data.save();
					} )
				}
			} )
		} break;
		case 'deletePost': {
			let chatId = query.message.chat.id;
			let messageId = query.message.message_id;

			DownloadQueueShema.findOne({
				where: {
					userChatId: chatId,
					messageId: messageId
				}
			}).then( data => {

				if (data instanceof DownloadQueueShema) {
					bot.answerCallbackQuery(query.id, '🚫 пост удален');
					bot.deleteMessage(chatId, data.messageId);
					data.destroy();
					data.save();
				
				}
			} )
		} break;
		case 'confirmAsExclusivePost': {
			let chatId = query.message.chat.id;
			let messageId = query.message.message_id;

			DownloadQueueShema.findOne({
				where: {
					userChatId: chatId,
					messageId: messageId
				}
			}).then( data => {

				if (data instanceof DownloadQueueShema) {

					UserShema.findOne({
						where: {
							chatId: data.userChatId
						}
					}).then( authorPost => {

						if ( authorPost.isAdmin ) {
							downloadPhoto(data, '/posts').then( () => {
								createPostInDB(data.name, data.userChatId, authorPost.userName, PostShema, true);
							} );
						} else {
							downloadPhoto(data, '/membersPosts').then( () => {
								createPostInDB(data.name, data.userChatId, authorPost.userName, MemberPostShema, true);
							} );
						}
						bot.answerCallbackQuery(query.id, '🔥 пост отправлен с пометкой эксклюзив');
						bot.deleteMessage(chatId, data.messageId);
						data.destroy();
						data.save();
					} )
				}
			} )
		} break;
		case 'deleteAllPost': {

			let chatId = query.message.chat.id;

			DownloadQueueShema.findAll({
				where: {
					userChatId: chatId
				}
			}).then( data => {

				data.forEach(item => {

					if ( item instanceof DownloadQueueShema ) {
						bot.answerCallbackQuery(query.id, '🗑 посты удалены');
						bot.deleteMessage(chatId, item.messageId);
						item.destroy();
						item.save();
					}
				})
				
			} )
		} break;
	}

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
					bot.sendMessage(res.chatId, `привет, ${res.firstName}\nотправь пикчи, которые хочешь предложить`, {
						reply_markup: {
							keyboard: keyboard.userHome,
							resize_keyboard: true
						}
					});
				} );
			} break;
			default: 
				bot.sendMessage(chatId, 'подпишись и продолжим:', {
					reply_markup: {
						inline_keyboard: [
							[
								{
									text: 'подписаться',
									url: 'https://t.me/prnaddiction'
								}
							]

						]
					}
				});
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
					updateInfo(postingInterval, onPosting, userAdmin.userName).then( data => {
						bot.sendMessage(userAdmin.chatId, 
							`постинг: ${ data.onPosting ? 'исполняется' : 'остановлен'}
							\nколичество постов в архиве: ${data.countOfPost}
							\nинтервал постинга: ${(data.postingInterval / 60000).toFixed(2)} мин
							\nпримерное время постинга: ${data.estimatedPostingTime}`);
					} );
				} break;
				case kb.adminHome.startStopPosting: {			

					startStopPosting(userAdmin).then( data => {
						if (data instanceof InfoShema) {
							let autoPostingIs;

							data.onPosting ? autoPostingIs = 'запущен' : autoPostingIs = 'остановлен';
							
							bot.sendMessage(userAdmin.chatId, `автопостинг ${autoPostingIs}`);
						}
					})

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
		\n👤 в предложку добавляются посты от пользователей по очереди
		\n🌁 если они кончились - перезайди в предложку
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

						let formData = new FormData;
						let membersPostsKeyboard = {
							inline_keyboard: [
								[
									{
										text: '✅',
										callback_data: 'publishMemberPost'
									},
									{
										text: '🚫',
										callback_data: 'deleteMemberPost'
									},
								],
								[
									{
										text: 'B A N',
										callback_data: 'blockMemberPost',
	
									},
									{
										text: '🗑 all',
										callback_data: 'deleteAllMemberPost'
									}
								]
							]
						}

						
						
						formData.append('chat_id', userAdmin.chatId);
						formData.append('photo', fs.createReadStream(path.join(__dirname, `/membersPosts/`) + memberPost.name + '.jpg'));
						formData.append('reply_markup', JSON.stringify(membersPostsKeyboard));
						formData.append('parse_mode', 'MarkdownV2');

						if ( memberPost.exclusive ) {
							formData.append('caption', `[👤 ${memberInfo.firstName}](https://t.me/${memberInfo.userName})
							\n🔥 exclusive`);
						} else {
							formData.append('caption', `[👤 ${memberInfo.firstName}](https://t.me/${memberInfo.userName})`);
						}

						axios.post(`${telegramAPI}sendPhoto`, formData, {
							headers: {
								"Content-Type": "multipart/form-data; charset=UTF-8"
							}
						}).then( (msg) => {
							memberPost.messageId = msg.data.result.message_id;
							memberPost.workInChatId = userAdmin.chatId;
							memberPost.save();
						} ).catch( e => console.log(e))
	
					} )

				} )
	
			} )
		} else {
			bot.sendMessage(userAdmin.chatId, '📤 предложка пуста', {
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

				let newInterval = msg.text * 60000;

				updateInfo(newInterval, onPosting, userAdmin.userName).then( (data) => {

					if ( data instanceof InfoShema) {

						postingInterval = data.postingInterval;

						if ( onPosting ) {
							clearInterval(postingTimerID);
							postingTimerID = setInterval(autoPost, postingInterval);
						}

						bot.sendMessage(userAdmin.chatId, `интервал изменен: ${data.postingInterval / 60000} мин
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
	
			return download(downloadLink, path.join(__dirname, folder), {filename: `${fileName}.jpg`})
		})
	)
	
}

//добавляет запись с постом в очередь постинга либо в предложку
async function createPostInDB(name, chatId, authorUserName, Shema, exclusive = false) {

	await Shema.create({
		name: name,
		userChatId: chatId,
		authorUserName: authorUserName,
		exclusive: exclusive
	})
}

function startStopPosting(userAdmin) {

	onPosting ? onPosting = false : onPosting = true;

	if ( onPosting ) {
		postingTimerID = setInterval(autoPost, postingInterval);
	} else {
		clearInterval(postingTimerID);
	}

	return updateInfo(postingInterval, onPosting, userAdmin.userName)

};

//записывает инфу о боте в БД и отдает результат
async function updateInfo(postingInterval, onPosting, userName) {

	let countOfPost = await PostShema.count();
	let estimatedPostingTime;

	//примерное время постинга, учитывая кол-во постов

	//подсчет в минутах
	estimatedPostingTime = ((postingInterval * 60000) * countOfPost).toFixed(2);

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






	



