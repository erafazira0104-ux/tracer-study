/**
 * Admin Login Controller
 * Menggunakan MySQL2 + bcrypt + session
 */

const bcrypt = require('bcrypt');
const db     = require('../../configs/db');

/* ── GET /admin/login ── */
exports.showLogin = (req, res) => {
  const error   = req.session.flash_error   || null;
  const success  = req.session.flash_success || null;
  delete req.session.flash_error;
  delete req.session.flash_success;
  res.render('admin/login', { error, success });
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