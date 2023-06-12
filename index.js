const {
	bot, 
	token, 
	telegramAPI, 
	channelId, 
	sequalize
} = require('./core.js');

//const Parse = require('./parse.js');

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

	//запуск прослушки кнопок админского диалога
	bot.onText(/[инфо|предложка|...]/, adminActions);

	//запуск прослушки пикч в диалоге
	bot.on('photo', addDownloadQueue);

	//запуск прослушки действий с постами при загрузке
	bot.on('callback_query', savePostFromQueue);

	//запись в логи бота
	updateInfo(1800000, false, 'prnaddictionBot', true).then( (data) => {
		onPosting = data.onPosting;
		postingInterval = data.postingInterval;
	} );

	//запуск прослушки админских действий
	bot.on('callback_query', inlineAdminButtonsActions);

	bot.on('polling_error', (error) => {
		console.log(error)
	});


	//запуск прослушки действий с источником парсинга
	//bot.on('callback_query', parsingActions);

	// bot.sendMessage(channelId, 'посты публикуются автоматически,\nконтент от подписчиков помечен как 🔥exclusive',{
	// 	reply_markup: {
	// 		inline_keyboard: [
	// 			[
	// 				{
	// 					text: 'предложка',
	// 					url: 'https://t.me/prnaddictionBot'
	// 				}
	// 			]
	// 		]
	// 	}
	// })

};

//обработка админских инлайн кнопок
function inlineAdminButtonsActions(query) {

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
		case 'showPostsDelete': {

			let chatId = query.message.chat.id;
			let messageId = query.message.message_id;

			let postID = query.message.caption.split('ID:')[1];
			postID = postID.split('\n')[0];
	
			PostShema.findOne({
				where: {
					ID: postID
				}
			}).then( (post) => {

				fs.unlink(path.join(__dirname, '/posts/') + post.name + '.jpg', (e) => {

					bot.editMessageCaption(`🚫 пост удален из очереди`, {
						chat_id: chatId,
						message_id: messageId
					});
	
					bot.answerCallbackQuery(query.id, '🚫 пост удален');

					post.destroy();
					post.save();

				});

			} ).catch( e => {

				console.log(e);

			} )

		} break;
		case 'changeAdminPermission': {

			let userName = query.message.text.split(':')[1];

			changeAdminPermission(userName).then( () => {
				bot.editMessageText(`${userName} разжалован`, {
					chat_id: query.message.chat.id,
					message_id: query.message.message_id
				});
			} )


		} break;
		case 'unblockUser': {

			let userName = query.message.text.split(':')[1];
			
			UserShema.findOne({
				where: {
					userName: userName
				}
			}).then( user => {
				unblockUser(user.chatId).then( () => {
					bot.editMessageText(`${userName} разбанен`, {
						chat_id: query.message.chat.id,
						message_id: query.message.message_id
					})
				} )
			} )

		} break;
		case 'startStopPosting': {

			if (onPosting) {
				onPosting = false;
				clearInterval(postingTimerID);
				bot.answerCallbackQuery(query.id, 'постинг остановлен');
			} else {
				onPosting = true;
				postingTimerID = setInterval(autoPost, postingInterval);
				bot.answerCallbackQuery(query.id, 'постинг запущен');
			};
		
			updateInfo(postingInterval, onPosting, query.message.chat.username, true).then( data => {
				bot.editMessageText(
					`🕹 постинг: ${ data.onPosting ? 'исполняется' : 'остановлен'}
					\n🌇 постов в очереди постинга: ${data.countOfPost}
					\n🔮 постов в предложке: ${data.countOfMembersPost}
					\n📊 интервал постинга: ${(data.postingInterval / 60000).toFixed(2)} мин
					\n⏳ примерное время постинга: ${data.estimatedPostingTime}`, 
				{
					chat_id: query.message.chat.id,
					message_id: query.message.message_id,
					reply_markup: {
						inline_keyboard: inlineKeyboard.postingSettings
					}
				});
			})

		} break;
		case 'changeInterval': {

			bot.editMessageText(`Текущее значение: ${postingInterval / 60000}\nвыбери новое:`, {
				chat_id: query.message.chat.id,
				message_id: query.message.message_id,
				reply_markup: {
					inline_keyboard: inlineKeyboard.changeIntervalValue
				}
			})

		} break;
		case '15':
		case '30':
		case '45':
		case '60':
		case '90':
		case '120':
		{

			postingInterval = query.data * 60000;
			updateInfo(postingInterval, onPosting, query.message.chat.username, true).then( data => {

				if ( data instanceof InfoShema) {

					if ( onPosting ) {
						clearInterval(postingTimerID);
						postingTimerID = setInterval(autoPost, postingInterval);
					}

					bot.editMessageText(
						`🕹 постинг: ${ data.onPosting ? 'исполняется' : 'остановлен'}
						\n🌇 постов в очереди постинга: ${data.countOfPost}
						\n🔮 постов в предложке: ${data.countOfMembersPost}
						\n📊 интервал постинга: ${(data.postingInterval / 60000).toFixed(2)} мин
						\n⏳ примерное время постинга: ${data.estimatedPostingTime}`, 
					{
						chat_id: query.message.chat.id,
						message_id: query.message.message_id,
						reply_markup: {
							inline_keyboard: inlineKeyboard.postingSettings
						}
					});

				}

			})

		} break;
		case 'showAdminList': {

			UserShema.findAll({
				where: {
					isAdmin: true,
					owner: false
				}
			}).then( users => {

				if ( users.length > 0 ) {

					users.forEach( user => {
	
						bot.sendMessage(query.message.chat.id, `💎 ${user.firstName}:${user.userName}`, {
							reply_markup: {
								inline_keyboard: inlineKeyboard.adminList
							}
						}).then( () => {
							bot.answerCallbackQuery(query.id, 'готово');
						})
						
					} )

				} else {
					bot.answerCallbackQuery(query.id, 'админов кроме тебя нет');
				}
	
			} )

		} break;
		case 'showBanList': {

			UserShema.findAll({
				where: {
					ban: true
				}
			}).then( users => {

				if ( users.length > 0 ) {
					users.forEach( user => {
	
						bot.sendMessage(query.message.chat.id, `👤 ${user.firstName}:${user.userName}`, {
							reply_markup: {
								inline_keyboard: inlineKeyboard.banList
							}
						});
		
					} );
					bot.answerCallbackQuery(query.id, 'готово');
				} else {
					bot.answerCallbackQuery(query.id, 'бан лист пуст');
				}
	
			} ) 

		} break;
		case 'setAdmin': {

			bot.editMessageText('введи username: ', {
				chat_id: query.message.chat.id,
				message_id: query.message.message_id
			})

			bot.onText(/@([A-Za-z0-9]+)/, (msg, [source, match]) => {
				bot.removeTextListener(/@([A-Za-z0-9]+)/);

				UserShema.findOne({
					where: {
						chatId: query.message.chat.id
					}
				}).then( requestUser => {

					if (requestUser.isAdmin) {
						UserShema.findOne({
							where: {
								userName: match
							}
						}).then( user => {
					
							if ( user.isAdmin ) {
								bot.answerCallbackQuery(query.id, 'уже админ');
							} else {
								user.isAdmin = true;
								user.save();
								bot.answerCallbackQuery(query.id, `${match} теперь админ`);
							}
							
						} ).catch( () => {
							bot.answerCallbackQuery(query.id, 'не найден');
						} )
					}
				})
			})

		} break;
		case 'postsQueue': {

			PostShema.findAll({
				order: [['ID']],
				limit: 10
			}).then( posts => {

				if ( posts.length > 0 ) {

					posts.forEach( post => {

						UserShema.findOne({
							where: {
								chatId: post.userChatId
							}
						}).then( author => {
	
							let formData = new FormData;
							let keyboard = {
								inline_keyboard: inlineKeyboard.showPosts
							}
		
							formData.append('chat_id', query.message.chat.id);
							formData.append('photo', fs.createReadStream(path.join(__dirname, `/posts/`) + post.name + '.jpg'));
							formData.append('reply_markup', JSON.stringify(keyboard));
							formData.append('parse_mode', 'MarkdownV2');
		
							if ( post.exclusive ) {
								formData.append('caption', `post ID:${post.ID}
								\n[👤 ${author.firstName}](https://t.me/${author.userName})
								\n🔥 эксклюзив`);
							} else {
								formData.append('caption', `post ID:${post.ID}
								\n[👤 ${author.firstName}](https://t.me/${author.userName})`);
							}
		
							axios.post(`${telegramAPI}sendPhoto`, formData, {
								headers: {
									"Content-Type": "multipart/form-data; charset=UTF-8"
								}
							}).catch( e => {
								console.log('не удалось отобразить пост из очереди постинга /showPosts')
							} )
	
						} )
	
	
					} )
				} else {
					bot.answerCallbackQuery(query.id, 'постов в очереди нет')
				}

			} )


		} break;
	}

}

//функция автопостинга в канал
async function autoPost() { 

	if (onPosting) {

		console.log('Posting ON, postingInterval: ', postingInterval);

		PostShema.findOne({
			order: [ [ 'ID' ] ]
		}).then( (data) => {

			if ( data instanceof PostShema ) {

				let formData = new FormData();

				formData.append('chat_id', channelId);
				
				formData.append('photo', fs.createReadStream(path.join(__dirname, '/posts/') + data.name + '.jpg'));

				formData.append('parse_mode', 'MarkdownV2');

				data.exclusive ? formData.append('caption', `[porn addiction](https://t.me/+Aia2GBiHwsg1NDdi) \\| \\#эксклюзив`) : formData.append('caption', `[porn addiction](https://t.me/+Aia2GBiHwsg1NDdi)`);

				axios.post(`${telegramAPI}sendPhoto`, formData , {
					headers: {
						"Content-Type": "multipart/form-data; charset=UTF-8"
					}
				}).then( (e) => {
	
					//console.log(e.data);

					fs.unlink(path.join(__dirname, '/posts/') + data.name + '.jpg', (err => {
						if (err) console.log(err);
					}) );
	
					data.destroy();
					
				} ).catch( (e) => {

					console.log(e);

					data.destroy();
					autoPost();
				} )

			} 
			else {
				clearInterval(postingTimerID);
				onPosting = false;
				updateInfo(postingInterval, onPosting, 'prnaddictionBot', true);
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
				let isOwner;

				response.data.result.status == 'creator' ? isOwner = true: isOwner = false;
	
				UserShema.create({
					chatId: userAdmin.getChatId(),
					owner: isOwner,
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
							\n⏳ примерное время постинга: ${data.estimatedPostingTime}`, 
							{reply_markup: {
								inline_keyboard: inlineKeyboard.postingSettings
							}});
						
					} );
				} break;
				case kb.adminHome.adminMembersPics: {
					getPostsFromMembers(userAdmin);
				} break;
				case kb.adminCloseMembersPics.mainMenu: {

					bot.sendMessage(userAdmin.chatId, `предложка закрыта`, {
						reply_markup: {
							keyboard: keyboard.adminHome,
							resize_keyboard: true
						}
					})

				} break;
				case kb.adminHome.more: {

					bot.sendMessage(userAdmin.chatId, 'выбери что-то:', {
						reply_markup: {
							inline_keyboard: inlineKeyboard.adminOptions,
						}
					})

				} break
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
							\n🔥 эксклюзив`);
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

//записывает инфу о боте в БД и отдает результат
async function updateInfo(postingInterval, onPosting, userName, writeData = false) {

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
	
	if (writeData) {
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
	} else {
		return data = {
			countOfPost: countOfPost,
			countOfMembersPost: countOfMembersPost,
			postingInterval: postingInterval,
			estimatedPostingTime: estimatedPostingTime,
			onPosting: onPosting,
			userName: userName

		}
	}

}

//подключение к БД, если успешно => старт начального диалога
connectToDB().then( () =>  start());





	



