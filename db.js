const { Sequelize } = require('sequelize');

module.exports = new Sequelize(
    'yamei',
    'postgres',
    'kerosene',
    {
        host: 'localhost',
        port: '5432',
        dialect: 'postgres'
    }
)