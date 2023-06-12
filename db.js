const { Sequelize } = require('sequelize');
require('dotenv').config();

// module.exports = new Sequelize(
//     'yamei',
//     'yamei',
//     'kerosene', 
//     {
//         host: 'localhost',
//         port: '5432',
//         dialect: 'postgres'
//     }
// )


//local
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