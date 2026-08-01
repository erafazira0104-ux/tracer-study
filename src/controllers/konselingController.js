const db = require('../configs/db');

const getKonseling = (req, res) => {
  db.query('SELECT COUNT(*) AS total FROM permintaan_konseling', [], (errCount, countRows) => {
    const totalKonsultasi = (countRows && countRows[0] && countRows[0].total) ? countRows[0].total : 0;

    db.query(
      `SELECT id, nama, bidang_keahlian, foto, whatsapp FROM konselor WHERE is_active = 1`,
      [],
      (err, konselors) => {
        if (err) {
          console.error('DB error konseling:', err);
          konselors = [];
        }
        res.render('konseling', {
          title: 'Layanan Konseling Karir',
          activeNav: 'konseling',
          konselors: konselors || [],
          totalKonsultasi: totalKonsultasi,
        });
      }
    );
  });
};

const getBookKonselor = (req, res) => {
  db.query(
    `SELECT k.*, a.nama AS konselor
     FROM konseling k
     JOIN admin a ON a.id = k.admin_id
     WHERE k.id = ? AND k.is_active = 1`,
    [req.params.id],
    (err, rows) => {
      if (err || rows.length === 0) return res.status(404).send('Sesi konseling tidak ditemukan.');
      res.render('booking', { title: `Booking — ${rows[0].judul}`, konselor: rows[0] });
    }
  );
};

const getMulaiKonseling = (req, res) => {
  db.query(
    'SELECT id, nama FROM admin WHERE is_active = 1',
    [],
    (err, konselors) => {
      res.render('mulai', { title: 'Mulai Konseling', konselors: konselors || [] });
    }
  );
};

module.exports = { getKonseling, getBookKonselor, getMulaiKonseling };