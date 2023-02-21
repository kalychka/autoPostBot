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
    memberPostsBack: [
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
    ]
}