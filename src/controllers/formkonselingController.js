const db = require('../configs/db');

// GET — tampilkan form
const getFormKonseling = (req, res) => {
  const selectedKonselorId = req.query.konselor_id || '';
  db.query(
    'SELECT id, nama FROM konselor WHERE is_active = 1 LIMIT 20',
    [],
    (err, konselors) => {
      res.render('formkonseling', {
        title    : 'Konsultasi Karir',
        activeNav: 'konseling',
        konselors: konselors || [],
        success  : false,
        error    : null,
        formData : { konselor: selectedKonselorId },
      });
    }
  );
};

const postFormKonseling = (req, res) => {
  try {
    const { nama, nim, tahunLulus, konselor, topik } = req.body;

    // Validasi — jika ada field kosong, kembali ke form
    if (!nama || !nim || !tahunLulus || !topik) {
      db.query('SELECT id, nama FROM konselor WHERE is_active = 1 LIMIT 20', [], (e, konselors) => {
        return res.render('formkonseling', {
          title    : 'Konsultasi Karir',
          konselors: konselors || [],
          success  : false,
          error    : 'Semua field wajib diisi.',
          formData : req.body,
        });
      });
      return;
    }

    // Periksa apakah NIM terdaftar di database (tabel alumni)
    db.query('SELECT id FROM alumni WHERE nim = ?', [nim.trim()], (errCheck, alumniRows) => {
      if (errCheck) {
        console.error('Error checking NIM in database:', errCheck);
        db.query('SELECT id, nama FROM konselor WHERE is_active = 1 LIMIT 20', [], (e, konselors) => {
          return res.render('formkonseling', {
            title    : 'Konsultasi Karir',
            konselors: konselors || [],
            success  : false,
            error    : 'Terjadi kesalahan sistem saat memvalidasi NIM.',
            formData : req.body,
          });
        });
        return;
      }

      if (!alumniRows || alumniRows.length === 0) {
        db.query('SELECT id, nama FROM konselor WHERE is_active = 1 LIMIT 20', [], (e, konselors) => {
          return res.render('formkonseling', {
            title    : 'Konsultasi Karir',
            konselors: konselors || [],
            success  : false,
            error    : 'NIM tidak terdaftar di database. Anda harus menjadi alumni terdaftar untuk mengajukan konseling.',
            formData : req.body,
          });
        });
        return;
      }

      // Simpan booking ke DB jika konseling_id tersedia
      db.query(
        `INSERT INTO permintaan_konseling (nama_alumni, nim, tahun_lulus, konselor_id, topik, status)
         VALUES (?, ?, ?, ?, ?, 'belum_dilayani')`,
        [nama.trim(), nim.trim(), parseInt(tahunLulus), konselor ? parseInt(konselor) : null, topik.trim()],
        (err) => {
          if (err) {
            console.error('Error saving counseling booking:', err);
            db.query('SELECT id, nama FROM konselor WHERE is_active = 1 LIMIT 20', [], (e, konselors) => {
              return res.render('formkonseling', {
                title    : 'Konsultasi Karir',
                konselors: konselors || [],
                success  : false,
                error    : 'Terjadi kesalahan sistem saat menyimpan permintaan.',
                formData : req.body,
              });
            });
            return;
          }

          // Redirect ke halaman sukses
          res.redirect('/konseling/riwayat');
        }
      );
    });

  } catch (err) {
    console.error('Error form konseling POST:', err);
    res.status(500).send('Terjadi kesalahan server.');
  }
};

module.exports = { getFormKonseling, postFormKonseling };

