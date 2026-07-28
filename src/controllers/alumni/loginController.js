/**
 * Alumni Login Controller
 * Menggunakan MySQL2 + bcrypt + session
 */

const bcrypt = require('bcrypt');
const db     = require('../../configs/db');

/* ── GET /login ── */
exports.showLogin = (req, res) => {
  const error   = req.session.flash_error   || null;
  const success  = req.session.flash_success || null;
  delete req.session.flash_error;
  delete req.session.flash_success;
  res.render('alumni/login', { error, success });
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
