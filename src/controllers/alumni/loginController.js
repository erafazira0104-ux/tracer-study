/**
 * Alumni Login Controller
 * Menggunakan MySQL2 + bcrypt + session
 */

const bcrypt = require('bcrypt');
const db     = require('../../configs/db');

/* ── GET /login ── */
exports.showLogin = (req, res) => {
  // 1. Primary Source: Check admin table (no_wa_pengirim)
  db.query(
    'SELECT no_wa_pengirim FROM admin WHERE no_wa_pengirim IS NOT NULL AND no_wa_pengirim != "" ORDER BY id ASC LIMIT 1',
    [],
    (errAdmin, aRows) => {
      let waAdmin = '';
      if (!errAdmin && aRows && aRows.length > 0 && aRows[0].no_wa_pengirim) {
        let clean = String(aRows[0].no_wa_pengirim).replace(/[^0-9]/g, '');
        if (clean.startsWith('0')) clean = '62' + clean.slice(1);
        if (clean) waAdmin = clean;
      }

      if (waAdmin) {
        return res.render('alumni/login', { whatsappAdmin: waAdmin });
      }

      // 2. Secondary Source: Check tracer_pengaturan
      db.query(
        'SELECT nilai FROM tracer_pengaturan WHERE kunci = "whatsapp_admin"',
        [],
        (errSetting, sRows) => {
          if (!errSetting && sRows && sRows.length > 0 && sRows[0].nilai) {
            let clean = String(sRows[0].nilai).replace(/[^0-9]/g, '');
            if (clean.startsWith('0')) clean = '62' + clean.slice(1);
            if (clean) waAdmin = clean;
          }

          if (!waAdmin) {
            // 3. Fallback: check active counselor
            db.query(
              'SELECT whatsapp FROM konselor WHERE is_active = 1 AND whatsapp IS NOT NULL AND whatsapp != "" LIMIT 1',
              [],
              (e2, r2) => {
                if (!e2 && r2 && r2.length > 0 && r2[0].whatsapp) {
                  let clean = String(r2[0].whatsapp).replace(/[^0-9]/g, '');
                  if (clean.startsWith('0')) clean = '62' + clean.slice(1);
                  if (clean) waAdmin = clean;
                }
                res.render('alumni/login', { whatsappAdmin: waAdmin || '6281936791163' });
              }
            );
          } else {
            res.render('alumni/login', { whatsappAdmin: waAdmin });
          }
        }
      );
    }
  );
};

/* ── POST /login ── */
exports.handleLogin = (req, res) => {
  const { nimOrEmail, password } = req.body;

  if (!nimOrEmail || !password) {
    req.session.flash_error = 'Username/email dan password wajib diisi.';
    return res.redirect('/login');
  }

  db.query(
    'SELECT * FROM alumni WHERE nim = ? OR email = ?',
    [nimOrEmail.trim(), nimOrEmail.trim()],
    async (err, results) => {
      if (err) {
        req.session.flash_error = 'Terjadi kesalahan server.';
        return res.redirect('/login');
      }

      if (results.length === 0) {
        req.session.flash_error = 'NIM/email atau password salah.';
        return res.redirect('/login');
      }

      const alumni = results[0];

      if (!alumni.is_active) {
        req.session.flash_error = 'Akun Anda sedang dinonaktifkan/belum aktif. Silakan hubungi Administrator.';
        return res.redirect('/login');
      }
      let match = false;
      try {
        match = await bcrypt.compare(password, alumni.password);
      } catch (e) {
        match = false;
      }

      // Fallback check against password_plain
      if (!match && alumni.password_plain && password === alumni.password_plain) {
        match = true;
      }

      if (!match) {
        req.session.flash_error = 'NIM/email atau password salah.';
        return res.redirect('/login');
      }

      // Set session
      req.session.alumniId   = alumni.id;
      req.session.alumniName = alumni.nama;
      req.session.alumniNim  = alumni.nim;

      // Update last_login
      db.query('UPDATE alumni SET last_login = NOW() WHERE id = ?', [alumni.id]);

      return res.redirect('/alumni/dashboard');
    }
  );
};

/* ── POST /logout ── */
exports.handleLogout = (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
};
