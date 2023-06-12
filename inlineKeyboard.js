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
    ],
    postingSettings: [
        [
            {
                text: '🕹 вкл/выкл постинг',
                callback_data: 'startStopPosting'
            },
            {
                text: '📊 интервал',
                callback_data: 'changeInterval'
            }
        ]
    ],
    changeIntervalValue: [
        [
            {
                text: '15',
                callback_data: '1'
            },
            {
                text: '30',
                callback_data: '30'
            },
            {
                text: '45',
                callback_data: '45'
            }
        ],
        [
            {
                text: '60',
                callback_data: '60'
            },
            {
                text: '90',
                callback_data: '90'
            },
            {
                text: '120',
                callback_data: '120'
            }
        ],
    ],
    adminOptions: [
        [
            {
                text: 'показать список админов',
                callback_data: 'showAdminList'
            }
        ],
        [
            {
                text: 'банлист',
                callback_data: 'showBanList'
            }
        ],
        [
            {
                text: 'выдать админку',
                callback_data: 'setAdmin'
            }
        ],
        [
            {
                text: 'очередь постов',
                callback_data: 'postsQueue'
            }
        ]
    ]

}