const { Sequelize } = require('sequelize');

module.exports = new Sequelize(
    'yamei',
    'kalychka',
    '9pniZRerMN5Y',
    {
        host: '94.26.224.171',
        port: '6432',
        dialect: 'postgres'
    }
)