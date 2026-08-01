const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function run() {
  let conn;
  try {
    conn = await mysql.createConnection({
      host: '127.0.0.1',
      user: 'root',
      password: ''
    });
    console.log('✅ Connected to MySQL.');
    
    const [rows] = await conn.query("SHOW VARIABLES LIKE 'datadir'");
    if (rows && rows.length > 0) {
      const datadir = rows[0].Value;
      console.log(`MySQL Datadir: ${datadir}`);
      
      const dbPath = path.join(datadir, 'tracer_study');
      console.log(`Database directory path: ${dbPath}`);
      
      if (fs.existsSync(dbPath)) {
        const files = fs.readdirSync(dbPath);
        console.log('Files inside directory:', files);
        
        for (const file of files) {
          const filePath = path.join(dbPath, file);
          try {
            fs.unlinkSync(filePath);
            console.log(`✅ Deleted file: ${file}`);
          } catch (err) {
            console.error(`❌ Failed to delete file ${file}:`, err.message);
          }
        }
        
        try {
          fs.rmdirSync(dbPath);
          console.log('✅ Deleted database directory.');
        } catch (err) {
          console.error('❌ Failed to delete database directory:', err.message);
        }
      } else {
        console.log('Database directory does not exist on disk.');
      }
    } else {
      console.error('Could not find datadir variable.');
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    if (conn) await conn.end();
  }
}

run();
