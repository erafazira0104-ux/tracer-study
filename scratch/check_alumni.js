const db = require('../src/configs/db');

db.query('DESCRIBE alumni', (err, rows) => {
  if (err) {
    console.error('Error describing alumni:', err);
  } else {
    console.table(rows);
  }
  process.exit();
});
