const kb = require('./keyboard-buttons')

module.exports = {
	adminHome: [
		[kb.adminHome.info, kb.adminHome.startStopPosting],
		[kb.adminHome.adminMembersPics, kb.adminHome.changeInterval]
	],
	adminBackMainMenu: [
		[kb.adminBackMainMenu.mainMenu]
	]
}