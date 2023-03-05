const {
	bot, 
	token, 
	telegramAPI, 
	channelId, 
	sequalize
} = require('./core.js');

const Parse = require('./parse.js');

const keyboard = require('./keyboard');

const inlineKeyboard = require('./inlineKeyboard');

const kb = require('./keyboard-buttons');

const axios = require('axios');

const fs = require('fs');

const path = require('path');

const download = require('download');

const {UserShema, PostShema, DownloadQueueShema, InfoShema, MemberPostShema, ParseQueueShema} = require('./models');

const FormData = require('form-data');

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
		console.log('liseten message');
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
						bot.sendMessage(user.chatId, 'отправка сообщений ограничена');
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
	bot.onText(/[инфо|on/off постинг|предложка|интервал|предложка]/, adminActions);

	//запуск прослушки пикч в диалоге
	bot.on('photo', addDownloadQueue);

	//запись в логи бота
	updateInfo(60000, false, 'prnaddictionBot').then( (data) => {
		onPosting = data.onPosting;
		postingInterval = data.postingInterval;
	} );

	//запуск прослушки действий с постами в предложке
	bot.on('callback_query', memberPostsActions);

	//запуск прослушки действий с постами при загрузке
	bot.on('callback_query', savePostFromQueue);

	//запуск прослушки действий с источником парсинга
	bot.on('callback_query', parsingActions);

};

//обработка кнопок под постами в предложке
function memberPostsActions(query) {

	switch ( query.data ) {
		case 'memberPostMainMenu': {

			MemberPostShema.findOne({
				where: {
					messageId: query.message.message_id,
					workInChatId: query.message.chat.id
				}
			}).then( (post) => {

				UserShema.findOne({
					where: {
						chatId: post.userChatId
					}
				}).then( (authorPost) => {

					let caption;

					if ( post.exclusive ) {

						caption = `[👤 ${authorPost.firstName}](https://t.me/${authorPost.userName})
						\n🔥 exclusive`

					} else {
						caption = `[👤 ${authorPost.firstName}](https://t.me/${authorPost.userName})`
					}

					bot.editMessageCaption(caption, {
						chat_id: query.message.chat.id,
						message_id: query.message.message_id,
						reply_markup: {
							inline_keyboard: inlineKeyboard.memberPosts
						},
						parse_mode: 'MarkdownV2'
					});

				} )

			} )

		} break;
		case 'blockMemberPost': {

			bot.editMessageCaption('заблокировать пользователя и удалить все его посты из предложки?', {
				chat_id: query.message.chat.id,
				message_id: query.message.message_id,
				reply_markup: {
					inline_keyboard: inlineKeyboard.memberPostsBlockBack
				}
			});

		} break;
		case 'blockMemberPostConfirm': {

			let chatId = query.message.chat.id;

			MemberPostShema.findAll({
				where: {
					workInChatId: chatId
				}
			}).then( posts => {

				posts.forEach( post => {

					bot.editMessageCaption(`🚫 пост удален из очереди`, {
						chat_id: chatId,
						message_id: post.messageId
					});

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
						bot.sendMessage(chatId, `👤 [${member.firstName}](https://t.me/${member.userName}) заблокирован`, {
							parse_mode: 'MarkdownV2'
						});
					} )
				} )

			} )	

		} break;
		case 'deleteAllMemberPost': {

			bot.editMessageCaption('удалить все его посты из предложки?', {
				chat_id: query.message.chat.id,
				message_id: query.message.message_id,
				reply_markup: {
					inline_keyboard: inlineKeyboard.memberPostsDeleteAllBack
				}
			});

		} break;
		case 'deleteAllMemberPostConfirm': {

			let chatId = query.message.chat.id;

			MemberPostShema.findAll({
				where: {
					workInChatId: chatId
				}
			}).then( posts => {

				posts.forEach( post => {

					bot.editMessageCaption(`🚫 пост удален из очереди`, {
						chat_id: chatId,
						message_id: post.messageId
					});

					fs.unlink(path.join(__dirname, '/membersPosts/') + post.name + '.jpg', (e) => {
						console.log(e);
						post.destroy();
						post.save();
					});
					
				} );
				bot.answerCallbackQuery(query.id, '🚫 посты удалены');
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

				fs.unlink(path.join(__dirname, '/membersPosts/') + post.name + '.jpg', (e) => {
					console.log(e);

					bot.editMessageCaption(`🚫 пост удален из очереди`, {
						chat_id: chatId,
						message_id: post.messageId
					});
	
					bot.answerCallbackQuery(query.id, '🚫 пост удален');

					post.destroy();
					post.save();
				});


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

				if ( post.exclusive ) {
					createPostInDB(post.name, post.userChatId, post.authorUserName, PostShema, true);
				} else {
					createPostInDB(post.name, post.userChatId, post.authorUserName, PostShema);
				}

				fs.rename( path.join(__dirname + '/membersPosts/') + post.name + '.jpg', path.join(__dirname + '/posts/') + post.name + '.jpg', () => {
					
					bot.editMessageCaption(`💾 пост добавлен в очередь постинга`, {
						chat_id: chatId,
						message_id: post.messageId
					});

					bot.answerCallbackQuery(query.id, '💾 добавлен в очередь постинга');
					post.destroy();
					post.save();
				} )
			} )
		} break;
	}

}

//обработка кнопок в меню выбора источника парсинга
function parsingActions(query) {

	switch (query.data) {

		case 'parseJoyReactorSuicideGirls': {

			Parse.getPicsFromJoyreactorSuicideGirls();

		} break;
		case 'JoyReactorSuicideGirlsShow': {
			
			Parse.getPicsFromParseLib('joyReactorSuicideGirls', query.message.chat.id);

		} break;

	}

}

//функция автопостинга в канал
async function autoPost() { 

	if (onPosting) {

		console.log('Posting ON, postingInterval: ', postingInterval);

		PostShema.findOne({
			order: [ [ 'ID' ]]
		}).then( (data) => {

			if ( data instanceof PostShema ) {

				let formData = new FormData();

				formData.append('chat_id', channelId);
				
				formData.append('photo', fs.createReadStream(path.join(__dirname, '/posts/') + data.name + '.jpg'));
				
				if ( data.exclusive ) {
					formData.append('caption', '#эксклюзив');
				};
	
				axios.post(`${telegramAPI}sendPhoto`, formData , {
					headers: {
						"Content-Type": "multipart/form-data; charset=UTF-8"
					}
				}).then( () => {
	
					fs.unlink(path.join(__dirname, '/posts/') + data.name + '.jpg', (err => {
						if (err) console.log(err);
					}) );
	
					data.destroy();
					
				} ).catch( () => {
					
					console.log('pic not found: ', data.name);
					data.destroy();
					autoPost();
				} )

			} else {
				startStopPosting();
			}
	
		} )

	}
	
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
							inline_keyboard: inlineKeyboard.loadPic
						}

						formData.append('chat_id', user.chatId);
						formData.append('photo',  data.name);
						formData.append('reply_markup', JSON.stringify(uploadKeyboard));
						
						formData.append('caption', `\n✅ - загрузить, ✅all - загрузить все 
						\n🔥 - загрузить как личное фото
						\n🚫 - удалить, 🗑all - удалить все фото `);

	
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
		} else {
			bot.sendMessage(msg.chat.id, 'не узнал тебя, введи /start');
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

						let picPath;
						let postShema;

						authorPost.isAdmin ? picPath = '/posts' : picPath = '/membersPosts';
						authorPost.isAdmin ? postShema = PostShema : postShema = MemberPostShema;

						downloadPhoto(data, picPath).then( () => {
							createPostInDB(data.name, data.userChatId, authorPost.userName, postShema);
							bot.editMessageCaption('💾 загружено', {
								chat_id: chatId,
								message_id: data.messageId
							});
							bot.answerCallbackQuery(query.id, '💾 пост сохранен >8');
						} ).catch( () => {
							bot.editMessageCaption('не удалось, попробуй еще раз', {
								chat_id: chatId,
								message_id: data.messageId
							});
						} )
						 
						data.destroy();
						data.save();
					} )
				}
			} )
		} break;
		case 'confirmAllPost': {

			let chatId = query.message.chat.id;

			UserShema.findOne({
				where: {
					chatId: chatId
				}
			}).then( user => {

				DownloadQueueShema.findAll({
					where: {
						userChatId: user.chatId
					}
				}).then( data => {
	
					data.forEach( item => {

						if (item instanceof DownloadQueueShema) {
	
							let picPath;
							let postShema;
	
							user.isAdmin ? picPath = '/posts' : picPath = '/membersPosts';
							user.isAdmin ? postShema = PostShema : postShema = MemberPostShema;
	
							downloadPhoto(item, picPath).then( () => {
								createPostInDB(item.name, item.userChatId, user.userName, postShema);
								bot.editMessageCaption('💾 загружено', {
									chat_id: user.chatId,
									message_id: item.messageId
								});
								
							} ).catch( () => {
								bot.editMessageCaption('не удалось, попробуй еще раз', {
									chat_id: user.chatId,
									message_id: item.messageId
								});
							} )
								
							item.destroy();
							item.save();
							
						}
					} )
	
				} )
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

						let picPath;
						let postShema;

						authorPost.isAdmin ? picPath = '/posts' : picPath = '/membersPosts';
						authorPost.isAdmin ? postShema = PostShema : postShema = MemberPostShema;

						downloadPhoto(data, picPath).then( () => {
							createPostInDB(data.name, data.userChatId, authorPost.userName, postShema, true);
							bot.editMessageCaption('💾 загружено как 🔥 пост', {
								chat_id: chatId,
								message_id: data.messageId
							});
							bot.answerCallbackQuery(query.id, '🔥 пост отправлен с пометкой эксклюзив');
						} ).catch( () => {
							bot.editMessageCaption('не удалось, попробуй еще раз', {
								chat_id: chatId,
								message_id: data.messageId
							});
						} )

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
							`🕹 постинг: ${ data.onPosting ? 'исполняется' : 'остановлен'}
							\n🌇 постов в очереди постинга: ${data.countOfPost}
							\n🔮 постов в предложке: ${data.countOfMembersPost}
							\n📊 интервал постинга: ${(data.postingInterval / 60000).toFixed(2)} мин
							\n⏳ примерное время постинга: ${data.estimatedPostingTime}`);
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
				case kb.adminCloseMembersPics.mainMenu: {

					// MemberPostShema.findAll({
					// 	where: {
					// 		workInChatId: userAdmin.chatId
					// 	}
					// }).then( posts => {
						
					// 	posts.forEach( row => {

					// 		bot.deleteMessage(userAdmin.chatId, row.messageId);
					// 		row.messageId = null;
					// 		row.workInChatId = null;
					// 		row.save();

					// 	} );
						

					// } )

					bot.sendMessage(userAdmin.chatId, `предложка закрыта`, {
						reply_markup: {
							keyboard: keyboard.adminHome,
							resize_keyboard: true
						}
					})

				} break;
				case kb.adminHome.parsing: {

					bot.sendMessage(userAdmin.chatId, `выбери источник: `, {
						reply_markup: {
							keyboard: keyboard.adminParsing,
							resize_keyboard: true
						}
					})

				} break;
				case kb.adminCloseParseMenu.mainMenu: {

					bot.sendMessage(userAdmin.chatId, `меню парсинга закрыто`, {
						reply_markup: {
							keyboard: keyboard.adminHome,
							resize_keyboard: true
						}
					})

				} break;
				case kb.adminParseSource.joyReactor: {
					
					bot.sendMessage(userAdmin.chatId, `парсинг для joyReactor доступен с досок:`, {
						reply_markup: {
							inline_keyboard: inlineKeyboard.parseJoyReactor
						}
					});

				} break;
			}
		}

	} )
}

//получение постов из предложки
function getPostsFromMembers(userAdmin) {

	MemberPostShema.findOne({
		order: [ [ 'ID' ]],
		where: {
			workInChatId: null
		}
	}).then( (post) => {

		if ( post instanceof MemberPostShema ) {

			bot.sendMessage(userAdmin.chatId, `
			\n👤 в предложку добавляются посты от пользователей по очереди
			\n🌁 если они кончились - перезайди в предложку
			`, {
				reply_markup: {
					keyboard: keyboard.adminCloseMembersPics,
					resize_keyboard: true
				}
			});

			MemberPostShema.findAll({
				where: {
					userChatId: post.userChatId
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
							inline_keyboard: inlineKeyboard.memberPosts
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
						} ).catch( e => {
							console.log('не удалось загрузить пикчу из архива:', e);
							memberPost.destroy();
							memberPost.save();
						})
	
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

			if ( msg.text >= 1 && msg.text != (postingInterval / 60000) ) {

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
			} else {
				bot.sendMessage(userAdmin.chatId, 'недопустимое значение либо интервал уже установлен в этом значении')
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

function startStopPosting(userAdmin = {userName: '@prnaddictionBot'}) {

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
	let countOfMembersPost = await MemberPostShema.count();
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
			countOfMembersPost: countOfMembersPost,
			postingInterval: postingInterval,
			estimatedPostingTime: estimatedPostingTime,
			onPosting: onPosting,
			userName: userName
		})
	)
}

//подключение к БД, если успешно => старт начального диалога
connectToDB().then( () =>  start());





	



