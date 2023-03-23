const kb = require('./keyboard-buttons')

module.exports = {
	adminHome: [
		[kb.adminHome.info, kb.adminHome.adminMembersPics],
		[kb.adminHome.more]
	],
	adminMore: [
		[kb.adminMore.startStopPosting, kb.adminMore.changeInterval],
		//[kb.adminMore.parsing],
		[kb.adminMore.back]
	],
	adminCloseMembersPics: [
		[kb.adminCloseMembersPics.mainMenu]
	],
	adminParsing: [
		[kb.adminParseSource.joyReactor],
		[kb.adminCloseParseMenu.mainMenu]
	]
}