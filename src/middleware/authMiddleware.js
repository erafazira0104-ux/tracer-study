/**
 * Auth Middleware
 * Proteksi route admin dan alumni menggunakan session
 */

/** Hanya bisa diakses jika sudah login sebagai admin */
const isAdminLoggedIn = (req, res, next) => {
  if (req.session && req.session.adminId) {
    return next();
  }
  req.session.flash_error = 'Silakan login terlebih dahulu.';
  return res.redirect('/admin/login');
};

/** Hanya bisa diakses jika sudah login sebagai alumni */
const isAlumniLoggedIn = (req, res, next) => {
  if (req.session && req.session.alumniId) {
    return next();
  }
  req.session.flash_error = 'Silakan login terlebih dahulu.';
  return res.redirect('/login');
};

/** Jika sudah login admin, jangan tampilkan halaman login */
const redirectIfAdminLoggedIn = (req, res, next) => {
  if (req.session && req.session.adminId) {
    return res.redirect('/admin/dashboard');
  }
  next();
};

/** Jika sudah login alumni, jangan tampilkan halaman login */
const redirectIfAlumniLoggedIn = (req, res, next) => {
  if (req.session && req.session.alumniId) {
    return res.redirect('/alumni/dashboard');
  }
  next();
};

module.exports = {
  isAdminLoggedIn,
  isAlumniLoggedIn,
  redirectIfAdminLoggedIn,
  redirectIfAlumniLoggedIn,
};
