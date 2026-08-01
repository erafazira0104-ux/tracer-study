/**
 * Admin Login Controller
 * Menggunakan MySQL2 + bcrypt + session
 */

const bcrypt = require('bcrypt');
const db     = require('../../configs/db');

/* ── GET /admin/login ── */
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
        return res.render('admin/login', { whatsappAdmin: waAdmin });
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
                res.render('admin/login', { whatsappAdmin: waAdmin || '6281936791163' });
              }
            );
          } else {
            res.render('admin/login', { whatsappAdmin: waAdmin });
          }
        }
      );
    }
  );
};

/* ── POST /admin/login ── */
exports.handleLogin = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    req.session.flash_error = 'Username dan password wajib diisi.';
    return res.redirect('/admin/login');
  }

  try {
    db.query(
      'SELECT * FROM admin WHERE username = ? AND is_active = 1',
      [username.trim()],
      async (err, results) => {
        if (err) {
          console.error('DB error:', err);
          req.session.flash_error = 'Terjadi kesalahan server.';
          return res.redirect('/admin/login');
        }

        if (results.length === 0) {
          req.session.flash_error = 'Username atau password salah.';
          return res.redirect('/admin/login');
        }

        const admin = results[0];
        const match = await bcrypt.compare(password, admin.password);

        if (!match) {
          req.session.flash_error = 'Username atau password salah.';
          return res.redirect('/admin/login');
        }

        // Simpan di session
        req.session.adminId   = admin.id;
        req.session.adminName = admin.nama;
        req.session.adminUser = admin.username;
        req.session.adminFoto = admin.foto;

        // Update last login
        db.query('UPDATE admin SET updated_at = NOW() WHERE id = ?', [admin.id]);

        return res.redirect('/admin/dashboard');
      }
    );
  } catch (error) {
    console.error('Login error:', error);
    req.session.flash_error = 'Terjadi kesalahan server.';
    return res.redirect('/admin/login');
  }
};

/* ── POST /admin/logout ── */
exports.handleLogout = (req, res) => {
  req.session.destroy(() => {
    res.redirect('/admin/login');
  });
};