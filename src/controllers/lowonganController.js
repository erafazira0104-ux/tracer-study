const db = require('../configs/db');

const PER_HALAMAN = 4;

const getLowonganPage = (req, res) => {
  try {
    const halaman = Math.max(1, parseInt(req.query.halaman) || 1);
    const offset = (halaman - 1) * PER_HALAMAN;

    // Hitung total lowongan aktif
    db.query('SELECT COUNT(*) AS total FROM lowongan WHERE is_active = 1', (err, countRows) => {
      if (err) {
        console.error('DB error counting lowongan:', err);
        return res.status(500).send('Terjadi kesalahan server saat menghitung data.');
      }

      const total = (countRows && countRows[0]) ? countRows[0].total : 0;
      const totalHalaman = Math.max(1, Math.ceil(total / PER_HALAMAN));

      // Ambil lowongan dengan paginasi (menggunakan angka terurai untuk keamanan sintaks MySQL)
      const sql = `SELECT * FROM lowongan WHERE is_active = 1 ORDER BY created_at DESC LIMIT ${PER_HALAMAN} OFFSET ${offset}`;
      db.query(sql, (err2, rows) => {
        if (err2) {
          console.error('DB error fetching lowongan:', err2);
          return res.status(500).send('Terjadi kesalahan server saat mengambil data lowongan.');
        }

        res.render('lowongan', {
          title: 'Lowongan Kerja',
          activeNav: 'lowongan',
          lowongans: rows || [],
          halaman,
          totalHalaman,
          alumniName: (req.session && req.session.alumniName) || res.locals.alumniName || '',
          alumniNim: (req.session && req.session.alumniNim) || res.locals.alumniNim || '',
          alumniEmail: (req.session && req.session.alumniEmail) || res.locals.alumniEmail || '',
        });
      });
    });
  } catch (error) {
    console.error('Error lowongan page:', error);
    res.status(500).send('Terjadi kesalahan server.');
  }
};

const logJobAccess = (req, res) => {
  const { lowongan_id, nama, nim, email, no_hp } = req.body;
  const alumniId = req.session && req.session.alumniId ? req.session.alumniId : null;

  if (!lowongan_id || !nama || !email || !nim) {
    return res.status(400).json({ ok: false, message: 'Nama, NIM, Email, dan Lowongan ID wajib diisi.' });
  }

  const cleanNim = nim.trim();
  const cleanNama = nama.trim();
  const cleanEmail = email.trim();
  const cleanHp = no_hp ? no_hp.trim() : null;

  // Periksa apakah NIM dan Nama terdaftar & cocok di database (tabel alumni)
  db.query('SELECT id, nama FROM alumni WHERE nim = ?', [cleanNim], (errCheck, alumniRows) => {
    if (errCheck) {
      console.error('Error checking NIM for job access:', errCheck);
      return res.status(500).json({ ok: false, message: 'Terjadi kesalahan sistem saat memvalidasi NIM.' });
    }

    if (!alumniRows || alumniRows.length === 0) {
      return res.status(400).json({ ok: false, message: 'NIM tidak terdaftar di database. Anda harus menjadi alumni terdaftar untuk mengakses lowongan.' });
    }

    const dbNama = (alumniRows[0].nama || '').trim().toLowerCase();
    if (dbNama !== cleanNama.toLowerCase()) {
      return res.status(400).json({ ok: false, message: 'Kombinasi NIM dan Nama tidak cocok dengan data alumni terdaftar di database. Silakan periksa kembali Nama Anda.' });
    }

    const matchedAlumniId = alumniId || alumniRows[0].id;

    db.query(
      `INSERT INTO lowongan_access (alumni_id, nama, nim, email, no_hp, lowongan_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [matchedAlumniId, cleanNama, cleanNim, cleanEmail, cleanHp, lowongan_id],
      (err) => {
        if (err) {
          console.error('Error logging job access:', err);
          return res.status(500).json({ ok: false, message: 'Gagal mencatat akses lowongan.' });
        }
        res.json({ ok: true });
      }
    );
  });
};

module.exports = { getLowonganPage, logJobAccess };