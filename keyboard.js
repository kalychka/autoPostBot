const keyboardButtons = require('./keyboard-buttons')
const kb = require('./keyboard-buttons')

module.exports = {
	adminHome: [
		//[kb.adminHome.createPost],
		[kb.adminHome.startUpload, kb.adminHome.cancelUpload],
		[kb.adminHome.info, kb.adminHome.startStopPosting],
		[kb.adminHome.adminMembersPics, kb.adminHome.changeInterval]
	],
	adminBackMainMenu: [
		[kb.adminBackMainMenu.mainMenu]
	],
	userHome: [
		[kb.userHome.startUpload, kb.userHome.cancelUpload]
	]
}