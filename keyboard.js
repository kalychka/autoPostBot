const kb = require('./keyboard-buttons')

module.exports = {
	adminHome: [
		[kb.adminHome.info, kb.adminHome.startStopPosting],
		[kb.adminHome.adminMembersPics, kb.adminHome.changeInterval],
		[kb.adminHome.parsing]
	],
	adminBack: [
		[kb.adminBack.back]
	],
	adminCloseMembersPics: [
		[kb.adminCloseMembersPics.mainMenu]
	],
	adminParsing: [
		[kb.adminParseSource.joyReactor],
		[kb.adminCloseParseMenu.mainMenu]
	]
}