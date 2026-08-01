const mysql = require('mysql2/promise');

async function test() {
  try {
    const conn = await mysql.createConnection({
      host: '127.0.0.1',
      user: 'root',
      password: '',
      database: 'tracer_study'
    });
    console.log('✅ Connected to database.');
    const [tables] = await conn.query('SHOW TABLES');
    console.log('Tables in database:');
    for (const t of tables) {
      const tableName = Object.values(t)[0];
      const [columns] = await conn.query(`SHOW COLUMNS FROM \`${tableName}\``);
      console.log(`\nTable: ${tableName}`);
      columns.forEach(col => {
        console.log(` - ${col.Field} (${col.Type})`);
      });
    }
    await conn.end();
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

test();
