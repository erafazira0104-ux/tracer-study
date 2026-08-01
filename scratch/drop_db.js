const mysql = require('mysql2/promise');

async function run() {
  try {
    const conn = await mysql.createConnection({
      host: '127.0.0.1',
      user: 'root',
      password: ''
    });
    console.log('✅ Connected to MySQL.');
    await conn.query('DROP DATABASE IF EXISTS `tracer_study`');
    console.log('✅ Dropped database tracer_study.');
    await conn.query('CREATE DATABASE `tracer_study`');
    console.log('✅ Recreated database tracer_study.');
    await conn.end();
  } catch (err) {
    console.error('❌ Error dropping/recreating database:', err.message);
  }
}

run();
