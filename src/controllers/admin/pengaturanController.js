const bcrypt = require('bcrypt');
const db = require('../../configs/db');

/* ── GET /admin/pengaturan ── */
exports.index = (req, res) => {
  db.query(`SELECT * FROM admin WHERE id = ?`, [req.session.adminId], (err, rows) => {
    if (err || !rows || rows.length === 0) return res.redirect('/admin/dashboard');
    res.render('admin/pengaturan', {
      title: 'Pengaturan Akun',
      adminName: req.session.adminName,
      admin: rows[0],
    });
  });
};

/* ── POST /admin/pengaturan/profil ── */
exports.updateProfil = (req, res) => {
  const { nama, email, nuptk, prodi, role, no_wa_pengirim } = req.body;
  
  let sql, params;
  if (req.file) {
    const foto = '/images/' + req.file.filename;
    sql = `UPDATE admin SET nama = ?, email = ?, nuptk = ?, prodi = ?, role = ?, no_wa_pengirim = ?, foto = ? WHERE id = ?`;
    params = [nama, email, nuptk || null, prodi || null, role || 'Super Admin', no_wa_pengirim || '081936791163', foto, req.session.adminId];
  } else {
    sql = `UPDATE admin SET nama = ?, email = ?, nuptk = ?, prodi = ?, role = ?, no_wa_pengirim = ? WHERE id = ?`;
    params = [nama, email, nuptk || null, prodi || null, role || 'Super Admin', no_wa_pengirim || '081936791163', req.session.adminId];
  }

  db.query(sql, params, (err) => {
    if (err) {
      console.error('Error updating admin profile:', err.message);
      req.session.flash_error = 'Gagal memperbarui profil (NUPTK/Email mungkin sudah dipakai).';
    } else {
      req.session.adminName = nama;
      if (req.file) {
        req.session.adminFoto = '/images/' + req.file.filename;
      }

      // Sync no_wa_pengirim to tracer_pengaturan under key whatsapp_admin
      if (no_wa_pengirim) {
        const cleanWa = no_wa_pengirim.trim().replace(/[^0-9]/g, '');
        db.query(
          `INSERT INTO tracer_pengaturan (kunci, nilai, keterangan)
           VALUES ('whatsapp_admin', ?, 'Nomor WhatsApp resmi Administrator / IT Support')
           ON DUPLICATE KEY UPDATE nilai = VALUES(nilai)`,
          [cleanWa],
          (eWa) => {
            if (eWa) console.error('Error syncing whatsapp_admin setting:', eWa.message);
          }
        );
      }

      req.session.flash_success = 'Profil & Nomor WhatsApp Administrator berhasil diperbarui.';
    }
    res.redirect('/admin/pengaturan');
  });
};

/* ── POST /admin/pengaturan/password ── */
exports.updatePassword = (req, res) => {
  const { password_lama, password_baru, konfirmasi_password } = req.body;

  db.query(`SELECT * FROM admin WHERE id = ?`, [req.session.adminId], async (err, rows) => {
    if (err || !rows || rows.length === 0) {
      req.session.flash_error = 'Terjadi kesalahan server.';
      return res.redirect('/admin/pengaturan');
    }

    const admin = rows[0];
    const match = await bcrypt.compare(password_lama || '', admin.password);
    if (!match) {
      req.session.flash_error = 'Password lama salah.';
      return res.redirect('/admin/pengaturan');
    }
    if (!password_baru || password_baru.length < 6) {
      req.session.flash_error = 'Password baru minimal 6 karakter.';
      return res.redirect('/admin/pengaturan');
    }
    if (password_baru !== konfirmasi_password) {
      req.session.flash_error = 'Konfirmasi password tidak cocok.';
      return res.redirect('/admin/pengaturan');
    }

    const hash = await bcrypt.hash(password_baru, 10);
    db.query(`UPDATE admin SET password = ? WHERE id = ?`, [hash, req.session.adminId], (e2) => {
      if (e2) {
        req.session.flash_error = 'Gagal memperbarui password.';
      } else {
        req.session.flash_success = 'Password berhasil diperbarui.';
      }
      res.redirect('/admin/pengaturan');
    });
  });
};
