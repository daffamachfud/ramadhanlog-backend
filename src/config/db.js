require('dotenv').config();
const knex = require('knex');

console.log('🔹 FILE db.js SEDANG DIEKSEKUSI 🔹');

const db = knex({
  client: 'pg',
  connection: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  },
});

console.log('🔹 KONEKSI DATABASE SUKSES TERBENTUK 🔹');

module.exports = db;
