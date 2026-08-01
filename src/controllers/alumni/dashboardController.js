/**
 * Alumni Dashboard Controller
 */
const db = require('../../configs/db');

exports.showDashboard = (req, res) => {
  const alumniId = req.session.alumniId;

  // Ambil profil alumni
  const profilePromise = new Promise((resolve, reject) => {
    db.query('SELECT * FROM alumni WHERE id = ?', [alumniId], (err, rows) => {
      if (err || rows.length === 0) reject(err);
      else resolve(rows[0]);
    });
  });

  // Fetch tracer study data (all entries for count, latest for display)
  const tracerPromise = new Promise((resolve, reject) => {
    db.query(
      'SELECT * FROM tracer_study WHERE alumni_id = ? ORDER BY tanggal_isi DESC',
      [alumniId],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      }
    );
  });

  // Lowongan terbaru
  const lowonganPromise = new Promise((resolve, reject) => {
    db.query(
      'SELECT * FROM lowongan WHERE is_active = 1 ORDER BY created_at DESC LIMIT 3',
      [],
      (err, rows) => { if (err) reject(err); else resolve(rows); }
    );
  });

  // Sesi konseling mendatang
  const konselingPromise = new Promise((resolve, reject) => {
    db.query(
      `SELECT k.*, a.nama AS konselor,
              IF(kb.id IS NOT NULL, 1, 0) AS sudah_booking
       FROM konseling k
       JOIN admin a ON a.id = k.admin_id
       LEFT JOIN konseling_booking kb ON kb.konseling_id = k.id AND kb.alumni_id = ?
       WHERE k.tanggal >= CURDATE() AND k.is_active = 1
       ORDER BY k.tanggal ASC LIMIT 3`,
      [alumniId],
      (err, rows) => { if (err) reject(err); else resolve(rows); }
    );
  });

  Promise.all([profilePromise, tracerPromise, lowonganPromise, konselingPromise])
    .then(([alumni, tracerList, lowongan, konseling]) => {
      const tracer = tracerList.length > 0 ? tracerList[0] : null;
      const jumlahPengisian = tracerList.length;

      // Calculate profile completion rate
      const profileFields = ['nama', 'email', 'no_hp', 'jenis_kelamin', 'tempat_lahir', 'tanggal_lahir', 'alamat', 'tahun_masuk', 'tahun_lulus', 'angkatan', 'ipk_terakhir', 'fakultas', 'program_studi'];
      let filledCount = 0;
      profileFields.forEach(field => {
        if (alumni[field] !== null && alumni[field] !== undefined && String(alumni[field]).trim() !== '') {
          filledCount++;
        }
      });
      const profilKelengkapan = Math.round((filledCount / profileFields.length) * 100);
      const tracerKelengkapan = tracer ? 100 : 0;

      res.render('alumni/dashboard', {
        title    : 'Dashboard Alumni',
        currentPage: 'dashboard',
        alumni,
        tracer,
        jumlahPengisian,
        profilKelengkapan,
        tracerKelengkapan,
        lowongan,
        konseling,
      });
    })
    .catch(err => {
      console.error('Dashboard alumni error:', err);
      res.status(500).send('Terjadi kesalahan server.');
    });
};
