const { Sequelize } = require('sequelize');

module.exports = new Sequelize(
    'yamei',
    'root',
    'root',
    {
        host: '188.68.219.157',
        port: '6432',
        dialect: 'postgres'
    }
)