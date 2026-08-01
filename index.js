const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const flash = require('connect-flash');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Setup View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src', 'views'));

// Middlewares
app.use(express.static(path.join(__dirname, 'src', 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());

app.use(session({
  secret: process.env.SESSION_SECRET || 'tracerstudysecret12345',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

app.use(flash());

// Global template variables middleware
app.use((req, res, next) => {
  res.locals.adminId = req.session.adminId || null;
  res.locals.adminName = req.session.adminName || null;
  res.locals.adminFoto = req.session.adminFoto || null;
  res.locals.alumniId = req.session.alumniId || null;
  res.locals.alumniName = req.session.alumniName || null;
  res.locals.alumniNim = req.session.alumniNim || null;

  // Salin custom session flash messages ke res.locals
  res.locals.flash_success = req.session.flash_success || req.flash('success')[0] || null;
  res.locals.flash_error = req.session.flash_error || req.flash('error')[0] || null;
  res.locals.error = res.locals.flash_error;
  res.locals.success = res.locals.flash_success;

  // Hapus dari session agar langsung bersih dan tidak muncul terus-menerus
  delete req.session.flash_success;
  delete req.session.flash_error;
  next();
});

// Import Routes
const berandaRoutes = require('./src/routes/berandaRoutes');
const tentangRoutes = require('./src/routes/tentangRoutes');
const lowonganRoutes = require('./src/routes/lowonganRoutes');
const konselingRoutes = require('./src/routes/konselingRoutes');
const formkonselingRoutes = require('./src/routes/formkonselingRoutes');
const riwayatkonselingRoutes = require('./src/routes/riwayatkonselingRoutes');

// Import Alumni Routes
const alumniLoginRoutes = require('./src/routes/alumni/loginRoutes');
const alumniDashboardRoutes = require('./src/routes/alumni/dashboardRoutes');
const alumniProfileRoutes = require('./src/routes/alumni/profileRoutes');
const alumniTracerRoutes = require('./src/routes/alumni/tracerRoutes');
const alumniChangePasswordRoutes = require('./src/routes/alumni/changePasswordRoutes');

// Import Admin Routes
const adminLoginRoutes = require('./src/routes/admin/loginRoutes');
const adminDashboardRoutes = require('./src/routes/admin/dashboardRoutes');
const adminAlumniRoutes = require('./src/routes/admin/alumniRoutes');
const adminTracerRoutes = require('./src/routes/admin/tracerRoutes');
const adminLowonganRoutes = require('./src/routes/admin/lowonganAdminRoutes');
const adminKonselingRoutes = require('./src/routes/admin/konselingAdminRoutes');
const adminPengingatRoutes = require('./src/routes/admin/pengingatRoutes');
const adminGrafikRoutes = require('./src/routes/admin/grafikRoutes');
const adminLaporanRoutes = require('./src/routes/admin/laporanRoutes');
const adminPengaturanRoutes = require('./src/routes/admin/pengaturanRoutes');

// Mount Landing Routes
app.use('/', berandaRoutes);
app.use('/tentang', tentangRoutes);
app.use('/lowongan', lowonganRoutes);
app.use('/konseling', konselingRoutes);
app.use('/konseling/form', formkonselingRoutes);
app.use('/konseling/riwayat', riwayatkonselingRoutes);

// Mount Alumni Routes
app.use('/login', alumniLoginRoutes);
app.use('/alumni/dashboard', alumniDashboardRoutes);
app.use('/alumni/profile', alumniProfileRoutes);
app.use('/alumni/tracer', alumniTracerRoutes);
app.use('/alumni/change-password', alumniChangePasswordRoutes);

// Mount Admin Routes
app.use('/admin/login', adminLoginRoutes);
app.use('/admin/dashboard', adminDashboardRoutes);
app.use('/admin/alumni', adminAlumniRoutes);
app.use('/admin/tracer', adminTracerRoutes);
app.use('/admin/lowongan', adminLowonganRoutes);
app.use('/admin/konseling', adminKonselingRoutes);
app.use('/admin/pengingat', adminPengingatRoutes);
app.use('/admin/grafik', adminGrafikRoutes);
app.use('/admin/laporan', adminLaporanRoutes);
app.use('/admin/pengaturan', adminPengaturanRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).render('404', { title: 'Halaman Tidak Ditemukan' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server Tracer Study berjalan di http://localhost:${PORT}`);
});