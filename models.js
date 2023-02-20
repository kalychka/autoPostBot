const sequalize = require('./db');

const {DataTypes} = require('sequelize');

const UserShema = sequalize.define('user', {
    chatId: {type: DataTypes.BIGINT, primaryKey: true, unique: true},
    isAdmin: {type: DataTypes.BOOLEAN},
    firstName: {type: DataTypes.STRING},
    userName: {type: DataTypes.STRING},
    ban: {type: DataTypes.BOOLEAN, defaultValue: false}
},
{
    timestamps: false,
})

const PostShema = sequalize.define('post', {
    ID: {type: DataTypes.INTEGER, primaryKey: true, unique: true, autoIncrement: true},
    name: {type: DataTypes.STRING},
    //chatId: {type: DataTypes.BIGINT},
    authorUserName: {type: DataTypes.STRING, allowNull: true},
    exclusive: {type: DataTypes.BOOLEAN}
},
{
    timestamps: false,
})

const MemberPostShema = sequalize.define('memberPost', {
    ID: {type: DataTypes.INTEGER, primaryKey: true, unique: true, autoIncrement: true},
    name: {type: DataTypes.STRING},
    //chatId: {type: DataTypes.BIGINT},
    authorUserName: {type: DataTypes.STRING, allowNull: true},
    //busy: {type: DataTypes.BOOLEAN, defaultValue: false},
    workInChatId: {type: DataTypes.BIGINT},
    messageId: {type: DataTypes.INTEGER},
    exclusive: {type: DataTypes.BOOLEAN}
},
{
    timestamps: false,
})

const DownloadQueueShema = sequalize.define('downloadQueue', {
    ID: {type: DataTypes.INTEGER, primaryKey: true, unique: true, autoIncrement: true},
    messageId: {type: DataTypes.INTEGER},
    //chatId: {type: DataTypes.BIGINT},
    name: {type: DataTypes.STRING},
    isAdmin: {type: DataTypes.BOOLEAN},
},
{
    timestamps: false,
})

const InfoShema = sequalize.define('info', {
    ID: {type: DataTypes.INTEGER, primaryKey: true, unique: true, autoIncrement: true},
    countOfPost: {type: DataTypes.INTEGER},
    countOfMembersPost: {type: DataTypes.INTEGER},
    postingInterval: {type: DataTypes.FLOAT},
    estimatedPostingTime: {type: DataTypes.STRING},
    onPosting: {type: DataTypes.BOOLEAN},
    userName: {type: DataTypes.STRING},
})

UserShema.hasMany(PostShema);
UserShema.hasMany(MemberPostShema);
UserShema.hasMany(DownloadQueueShema);
DownloadQueueShema.belongsTo(UserShema);

module.exports = {UserShema, PostShema, DownloadQueueShema, InfoShema, MemberPostShema};