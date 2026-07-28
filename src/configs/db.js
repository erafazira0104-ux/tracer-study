require('dotenv').config();
const mysql = require('mysql2');

const db = mysql.createConnection({
  host    : process.env.DB_HOST     || 'localhost',
  user    : process.env.DB_USER     || 'root',
  database: process.env.DB_NAME     || 'tracer_study',
  password: process.env.DB_PASSWORD || '',
});

db.connect((err) => {
  if (err) {
    console.error('❌ DATABASE GAGAL TERKONEKSI:', err.message);
  } else {
    console.log('✅ DATABASE BERHASIL TERKONEKSI');
  }
});

module.exports = db;