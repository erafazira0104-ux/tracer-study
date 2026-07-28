/**
 * Admin — Konselor Karir
 * Kelola permintaan konseling dari alumni + sesi konseling
 */
const db = require('../../configs/db');

/* ── GET /admin/konseling ── */
exports.index = (req, res) => {
  db.query(
    'SELECT * FROM konselor WHERE is_active = 1 ORDER BY created_at DESC',
    [],
    (err, rows) => {
      if (err) console.error('DB error fetching counselors:', err.message);
      res.render('admin/konseling', {
        title: 'Konselor Karir',
        adminName: req.session.adminName,
        konselorList: rows || [],
        flash_success: req.session.flash_success || null,
        flash_error: req.session.flash_error || null
      });
      delete req.session.flash_success;
      delete req.session.flash_error;
    }
  );
};

/* ── POST /admin/konseling/:id/status ── */
exports.updateStatus = (req, res) => {
  const { id } = req.params;
  const { status, catatan_admin } = req.body;
  db.query(
    `UPDATE permintaan_konseling SET status = ?, catatan_admin = ? WHERE id = ?`,
    [status === 'sudah_dilayani' ? 'sudah_dilayani' : 'belum_dilayani', catatan_admin || null, id],
    (err) => {
      if (err) console.error('DB error update status konseling:', err.message);
      res.redirect('/admin/konseling');
    }
  );
};

/* ── GET /admin/konseling/export ── */
exports.exportCsv = (req, res) => {
  db.query(
    `SELECT pk.*, k.nama AS nama_konselor
     FROM permintaan_konseling pk
     LEFT JOIN konselor k ON k.id = pk.konselor_id
     ORDER BY pk.created_at DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).send('Export error');
      const headers = ['Nama Alumni','NIM','Tahun Lulus','Konselor','Topik','Status','Tanggal'];
      const body = (rows || []).map(r => [
        r.nama_alumni, r.nim || '', r.tahun_lulus || '', r.nama_konselor || '-',
        r.topik, r.status, r.created_at,
      ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(','));
      const csv = [headers.join(','), ...body].join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="konseling_export.csv"');
      res.send('\uFEFF' + csv);
    }
  );
};

/* ── GET /admin/konseling/tambah-konselor ── */
exports.showTambahKonselor = (req, res) => {
  res.render('admin/tambah-konselor', {
    title: 'Tambah Konselor',
    adminName: req.session.adminName,
    error: null,
  });
};

/* ── POST /admin/konseling/tambah-konselor ── */
exports.storeKonselor = (req, res) => {
  const { nama, bidang_keahlian } = req.body;
  const foto = req.file ? '/images/' + req.file.filename : null;

  if (!nama || !bidang_keahlian) {
    return res.render('admin/tambah-konselor', {
      title: 'Tambah Konselor',
      adminName: req.session.adminName,
      error: 'Nama konselor dan bidang keahlian wajib diisi.',
    });
  }

  db.query(
    'INSERT INTO konselor (nama, bidang_keahlian, foto) VALUES (?, ?, ?)',
    [nama.trim(), bidang_keahlian.trim(), foto],
    (err) => {
      if (err) {
        console.error('DB error store konselor:', err.message);
        return res.render('admin/tambah-konselor', {
          title: 'Tambah Konselor',
          adminName: req.session.adminName,
          error: 'Gagal menyimpan data konselor.',
        });
      }
      req.session.flash_success = 'Konselor karir berhasil ditambahkan.';
      res.redirect('/admin/konseling');
    }
  );
};

/* ── POST /admin/konseling/delete/:id ── */
exports.destroyKonselor = (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM konselor WHERE id = ?', [id], (err) => {
    if (err) {
      console.error('DB error deleting counselor:', err);
      req.session.flash_error = 'Gagal menghapus data konselor.';
    } else {
      req.session.flash_success = 'Konselor karir berhasil dihapus.';
    }
    res.redirect('/admin/konseling');
  });
};

/* ── GET /admin/konseling/booking ── */
exports.listBookings = (req, res) => {
  db.query(
    `SELECT pk.*, k.nama AS nama_konselor
     FROM permintaan_konseling pk
     LEFT JOIN konselor k ON k.id = pk.konselor_id
     ORDER BY pk.created_at DESC`,
    [],
    (err, rows) => {
      if (err) console.error('DB error fetching bookings:', err.message);
      res.render('admin/konseling-booking', {
        title: 'Daftar Booking Konseling',
        adminName: req.session.adminName,
        bookings: rows || [],
      });
    }
  );
};

