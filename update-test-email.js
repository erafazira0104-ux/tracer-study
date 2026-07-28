require('dotenv').config();
const mysql = require('mysql2/promise');

async function run() {
  const host = process.env.DB_HOST || 'localhost';
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'tracer_study';

  console.log(`Connecting to database ${database}...`);
  const connection = await mysql.createConnection({ host, user, password, database });

  const testEmail = 'erafazira0104@gmail.com';
  console.log(`Updating alumnus ahmad@gmail.com to ${testEmail}...`);
  
  const [result] = await connection.execute(
    'UPDATE alumni SET email = ? WHERE nim = ?',
    [testEmail, '190101001']
  );

  console.log(`✅ Update successful! Rows affected: ${result.affectedRows}`);
  await connection.end();
}

run().catch(err => {
  console.error('❌ Error updating email:', err);
  process.exit(1);
});
