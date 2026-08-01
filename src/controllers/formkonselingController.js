const db = require('../configs/db');

// GET — tampilkan form
const getFormKonseling = (req, res) => {
  const selectedKonselorId = req.query.konselor_id || '';
  
  db.query('SELECT COUNT(*) AS total FROM permintaan_konseling', [], (errCount, countRows) => {
    const totalKonsultasi = (countRows && countRows[0] && countRows[0].total) ? countRows[0].total : 0;
    
    db.query(
      'SELECT id, nama FROM konselor WHERE is_active = 1 LIMIT 20',
      [],
      (err, konselors) => {
        res.render('formkonseling', {
          title          : 'Konsultasi Karir',
          activeNav      : 'konseling',
          konselors      : konselors || [],
          totalKonsultasi: totalKonsultasi,
          success        : false,
          error          : null,
          formData       : { konselor: selectedKonselorId },
        });
      }
    );
  });
};

const postFormKonseling = (req, res) => {
  try {
    const { nama, nim, tahunLulus, konselor, topik } = req.body;

    const renderWithError = (errMsg) => {
      db.query('SELECT COUNT(*) AS total FROM permintaan_konseling', [], (errCount, countRows) => {
        const totalKonsultasi = (countRows && countRows[0] && countRows[0].total) ? countRows[0].total : 0;
        db.query('SELECT id, nama FROM konselor WHERE is_active = 1 LIMIT 20', [], (e, konselors) => {
          return res.render('formkonseling', {
            title          : 'Konsultasi Karir',
            activeNav      : 'konseling',
            konselors      : konselors || [],
            totalKonsultasi: totalKonsultasi,
            success        : false,
            error          : errMsg,
            formData       : req.body,
          });
        });
      });
    };

    // Validasi — jika ada field kosong, kembali ke form
    if (!nama || !nim || !tahunLulus || !topik) {
      return renderWithError('Semua field wajib diisi.');
    }

    // Periksa apakah NIM dan Nama terdaftar & cocok di database (tabel alumni)
    db.query('SELECT id, nama FROM alumni WHERE nim = ?', [nim.trim()], (errCheck, alumniRows) => {
      if (errCheck) {
        console.error('Error checking NIM in database:', errCheck);
        return renderWithError('Terjadi kesalahan sistem saat memvalidasi NIM.');
      }

      if (!alumniRows || alumniRows.length === 0) {
        return renderWithError('NIM tidak terdaftar di database. Anda harus menjadi alumni terdaftar untuk mengajukan konseling.');
      }

      const dbNama = (alumniRows[0].nama || '').trim().toLowerCase();
      if (dbNama !== nama.trim().toLowerCase()) {
        return renderWithError('Kombinasi NIM dan Nama tidak cocok dengan data alumni terdaftar di database. Silakan periksa kembali Nama Anda.');
      }

      const konselorId = konselor ? parseInt(konselor) : null;

      // Simpan booking ke DB
      db.query(
        `INSERT INTO permintaan_konseling (nama_alumni, nim, tahun_lulus, konselor_id, topik, status)
         VALUES (?, ?, ?, ?, ?, 'belum_dilayani')`,
        [nama.trim(), nim.trim(), parseInt(tahunLulus), konselorId, topik.trim()],
        (err, result) => {
          if (err) {
            console.error('Error saving counseling booking:', err);
            return renderWithError('Terjadi kesalahan sistem saat menyimpan permintaan.');
          }

          const reqId = result ? result.insertId : '';

          // Redirect ke halaman sukses dengan request_id dan konselor_id
          let redirectUrl = '/konseling/riwayat?';
          const params = [];
          if (reqId) params.push(`request_id=${reqId}`);
          if (konselorId) params.push(`konselor_id=${konselorId}`);
          redirectUrl += params.join('&');

          res.redirect(redirectUrl);
        }
      );
    });

  } catch (err) {
    console.error('Error form konseling POST:', err);
    res.status(500).send('Terjadi kesalahan server.');
  }
};

module.exports = { getFormKonseling, postFormKonseling };

