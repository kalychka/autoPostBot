const keyboardButtons = require('./keyboard-buttons')
const kb = require('./keyboard-buttons')

module.exports = {
	adminHome: [
		[kb.adminHome.info, kb.adminHome.startStopPosting],
		[kb.adminHome.adminMembersPics]
	],
	confirmOrDeletePost: [
		[kb.confirmOrDeletePost.confirm, kb.confirmOrDeletePost.delete],
	],
	adminStartUpload: [
		[kb.adminStartUpload.confirm, kb.adminStartUpload.delete]
	],
	userHome: [
		[kb.userHome.offerPics]
	]
	


}