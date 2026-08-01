const db = require('../src/configs/db');

db.query('SELECT * FROM kuesioner_pertanyaan ORDER BY kategori, urutan, id', (err, rows) => {
  if (err) {
    console.error('Error fetching questions:', err);
  } else {
    console.table(rows.map(r => ({
      id: r.id,
      kategori: r.kategori,
      pertanyaan: r.pertanyaan,
      jenis_jawaban: r.jenis_jawaban,
      opsi_jawaban: r.opsi_jawaban,
      is_active: r.is_active,
      urutan: r.urutan
    })));
  }
  process.exit();
});
