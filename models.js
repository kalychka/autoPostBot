const sequalize = require('./db');

const {DataTypes} = require('sequelize');

const User = sequalize.define('user', {
    chatId: {type: DataTypes.INTEGER, primaryKey: true},
    isAdmin: {type: DataTypes.BOOLEAN},
    firstName: {type: DataTypes.STRING},
    userName: {type: DataTypes.STRING},
})

module.exports = User;