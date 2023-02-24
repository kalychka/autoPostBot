const { Sequelize } = require('sequelize');
require('dotenv').config();

const DB_PASS = process.env.DB_PASS;

module.exports = new Sequelize(`postgres://kalychka:${DB_PASS}@ep-silent-field-988195.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`)

// module.exports = new Sequelize(
//     'yamei',
//     'postgres',
//     'kerosene', 
//     {
//         host: 'localhost',
//         port: '5432',
//         dialect: 'postgres'
//     }
// )