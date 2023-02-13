const sequalize = require('./db');

const {DataTypes} = require('sequelize');

const UserShema = sequalize.define('user', {
    chatId: {type: DataTypes.BIGINT, primaryKey: true, unique: true},
    isAdmin: {type: DataTypes.BOOLEAN},
    firstName: {type: DataTypes.STRING},
    userName: {type: DataTypes.STRING},
})

const PostShema = sequalize.define('post', {
    ID: {type: DataTypes.INTEGER, primaryKey: true, unique: true, autoIncrement: true},
    name: {type: DataTypes.STRING},
    chatId: {type: DataTypes.BIGINT},
    authorUserName: {type: DataTypes.STRING, allowNull: true},
})

const DownloadQueueShema = sequalize.define('downloadQueue', {
    ID: {type: DataTypes.INTEGER, primaryKey: true, unique: true, autoIncrement: true},
    chatId: {type: DataTypes.BIGINT},
    name: {type: DataTypes.STRING},
    isAdmin: {type: DataTypes.BOOLEAN},
})

const InfoShema = sequalize.define('info', {
    ID: {type: DataTypes.INTEGER, primaryKey: true, unique: true, autoIncrement: true},
    countOfPost: {type: DataTypes.INTEGER},
    postingInterval: {type: DataTypes.INTEGER},
    estimatedPostingTime: {type: DataTypes.STRING},
    onPosting: {type: DataTypes.BOOLEAN},
    userName: {type: DataTypes.STRING},
})

UserShema.hasMany(PostShema);
UserShema.hasMany(DownloadQueueShema);

module.exports = {UserShema, PostShema, DownloadQueueShema, InfoShema};