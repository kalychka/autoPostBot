//const kb = require('./inlineKeyboard-buttons')

module.exports = {
    loadPic: [
        [
            {
                text: '✅',
                callback_data: 'confirmPost'
            },
            {
                text: '✅ all',
                callback_data: 'confirmAllPost'
            },
            {
                text: '🔥',
                callback_data: 'confirmAsExclusivePost',

            },

        ],
        [
            {
                text: '🚫',
                callback_data: 'deletePost'
            },
            {
                text: '🗑 all',
                callback_data: 'deleteAllPost'
            }
        ]
    ],
    memberPosts: [
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
    ],
    memberPostsBlockBack: [
        [
            {
                text: 'назад',
                callback_data: 'memberPostMainMenu'
            },
            {
                text: 'да',
                callback_data: 'blockMemberPostConfirm'
            },
        ]
    ],
    memberPostsDeleteAllBack: [
        [
            {
                text: 'назад',
                callback_data: 'memberPostMainMenu'
            },
            {
                text: 'да',
                callback_data: 'deleteAllMemberPostConfirm'
            },
        ]
    ],
    parseJoyReactor: [
        [
            {
                text: 'suicide girls',
                callback_data: 'parseJoyReactorSuicideGirls'
            },
            {
                text: 'показать',
                callback_data: 'JoyReactorSuicideGirlsShow'
            }
        ]
    ],
    parseOpenPic: [
        [
            {
                text: '✅',
                callback_data: 'parseOpenPicConfirm'
            },
            {
                text: '🚫',
                callback_data: 'parseOpenPicDecline'
            }
        ]
    ],
    adminList: [
        [
            {
                text: 'разжаловать',
                callback_data: 'changeAdminPermission'
            }
        ]
    ],
    banList: [
        [
            {
                text: 'разбанить',
                callback_data: 'unblockUser'
            }
        ]
    ],
    showPosts: [
        [
            {
                text: '🚫',
                callback_data: 'showPostsDelete'
            }
        ]
    ]

}