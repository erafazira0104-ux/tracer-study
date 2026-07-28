/**
 * Alumni Profile Controller
 */
const bcrypt = require('bcrypt');
const db = require('../../configs/db');

/* ── GET /alumni/profile ── */
exports.showProfile = (req, res) => {
  const alumniId = req.session.alumniId;

  db.query('SELECT * FROM alumni WHERE id = ?', [alumniId], (err, rows) => {
    if (err || rows.length === 0) {
      console.error('Error fetching profile:', err);
      return res.status(500).send('Terjadi kesalahan server.');
    }

    const alumni = rows[0];
    const error  = req.session.flash_error   || null;
    const success = req.session.flash_success || null;
    delete req.session.flash_error;
    delete req.session.flash_success;

    // Check if tracer is filled
    db.query('SELECT id FROM tracer_study WHERE alumni_id = ?', [alumniId], (errTracer, rowsTracer) => {
      const isTracerFilled = rowsTracer && rowsTracer.length > 0;
      
      res.render('alumni/profile', {
        title: 'Lengkapi Profil Alumni',
        currentPage: 'profile',
        alumni,
        isTracerFilled,
        error,
        success,
      });
    });
  });
};

/* ── POST /alumni/profile ── */
exports.updateProfile = (req, res) => {
  const alumniId = req.session.alumniId;
  const {
    nama, jenis_kelamin, no_hp, tempat_lahir, tanggal_lahir,
    email, alamat, ipk_terakhir, fakultas, program_studi,
    tahun_masuk, tahun_lulus, angkatan
  } = req.body;

  if (!nama || !email) {
    req.session.flash_error = 'Nama lengkap dan email wajib diisi.';
    return res.redirect('/alumni/profile');
  }

  const fields = {
    nama,
    jenis_kelamin : jenis_kelamin || null,
    no_hp         : no_hp || null,
    tempat_lahir  : tempat_lahir || null,
    tanggal_lahir : tanggal_lahir || null,
    email,
    alamat        : alamat || null,
    ipk_terakhir  : ipk_terakhir ? parseFloat(ipk_terakhir) : null,
    fakultas      : fakultas || null,
    program_studi : program_studi || null,
    tahun_masuk   : tahun_masuk ? parseInt(tahun_masuk) : null,
    tahun_lulus   : tahun_lulus ? parseInt(tahun_lulus) : null,
    angkatan      : angkatan || null,
  };

  db.query('UPDATE alumni SET ? WHERE id = ?', [fields, alumniId], (err) => {
    if (err) {
      console.error('Error updating profile:', err);
      if (err.code === 'ER_DUP_ENTRY') {
        req.session.flash_error = 'Email sudah digunakan oleh alumni lain.';
      } else {
        req.session.flash_error = 'Gagal menyimpan perubahan profil.';
      }
    } else {
      // Update session name if changed
      req.session.alumniName = nama;
      req.session.flash_success = 'Perubahan profil berhasil disimpan!';
    }
    res.redirect('/alumni/profile');
  });
};

/* ── GET /alumni/change-password ── */
exports.showChangePassword = (req, res) => {
  const alumniId = req.session.alumniId;

  db.query('SELECT * FROM alumni WHERE id = ?', [alumniId], (err, rows) => {
    if (err || rows.length === 0) {
      console.error('Error fetching alumni:', err);
      return res.status(500).send('Terjadi kesalahan server.');
    }

    const alumni = rows[0];
    const error  = req.session.flash_error   || null;
    const success = req.session.flash_success || null;
    delete req.session.flash_error;
    delete req.session.flash_success;

    res.render('alumni/change-password', {
      title: 'Ganti Sandi',
      currentPage: 'change-password',
      alumni,
      error,
      success,
    });
  });
};

/* ── POST /alumni/change-password ── */
exports.changePassword = async (req, res) => {
  const alumniId = req.session.alumniId;
  const { current_password, new_password, confirm_password } = req.body;

  // Validasi input
  if (!current_password || !new_password || !confirm_password) {
    req.session.flash_error = 'Semua field password wajib diisi.';
    return res.redirect('/alumni/change-password');
  }

  if (new_password.length < 6) {
    req.session.flash_error = 'Password baru minimal 6 karakter.';
    return res.redirect('/alumni/change-password');
  }

  if (new_password !== confirm_password) {
    req.session.flash_error = 'Password baru dan konfirmasi password tidak cocok.';
    return res.redirect('/alumni/change-password');
  }

  try {
    // Ambil password lama dari database
    db.query('SELECT password FROM alumni WHERE id = ?', [alumniId], async (err, rows) => {
      if (err || rows.length === 0) {
        console.error('Error fetching alumni password:', err);
        req.session.flash_error = 'Terjadi kesalahan server.';
        return res.redirect('/alumni/change-password');
      }

      const alumni = rows[0];

      // Verifikasi password lama
      const isMatch = await bcrypt.compare(current_password, alumni.password);
      if (!isMatch) {
        req.session.flash_error = 'Password lama salah.';
        return res.redirect('/alumni/change-password');
      }

      // Hash password baru dan simpan ke database
      const newHash = await bcrypt.hash(new_password, 10);
      db.query('UPDATE alumni SET password = ?, password_plain = ? WHERE id = ?', [newHash, new_password, alumniId], (updateErr) => {
        if (updateErr) {
          console.error('Error updating password:', updateErr);
          req.session.flash_error = 'Gagal mengubah password.';
        } else {
          req.session.flash_success = 'Password berhasil diubah! Gunakan password baru saat login berikutnya.';
        }
        res.redirect('/alumni/change-password');
      });
    });
  } catch (error) {
    console.error('Change password error:', error);
    req.session.flash_error = 'Terjadi kesalahan server.';
    res.redirect('/alumni/change-password');
  }
};
