/**
 * Admin — Manajemen Lowongan Controller
 */
const db = require('../../configs/db');

/* ── GET /admin/lowongan ── */
exports.index = (req, res) => {
  db.query(
    'SELECT * FROM lowongan ORDER BY created_at DESC',
    [],
    (err, rows) => {
      if (err) return res.status(500).send('DB error');
      res.render('admin/lowongan', {
        title        : 'Manajemen Lowongan',
        adminName    : req.session.adminName,
        lowongan     : rows,
      });
    }
  );
};

/* ── GET /admin/lowongan/tambah ── */
exports.showTambah = (req, res) => {
  res.render('admin/lowongan-form', {
    title    : 'Tambah Lowongan',
    adminName: req.session.adminName,
    lowongan : null,
    error    : null,
  });
};

/* ── POST /admin/lowongan/tambah ── */
exports.store = (req, res) => {
  const { judul, deskripsi, deadline, link } = req.body;
  const perusahaan = req.body.perusahaan || '-';
  const lokasi = req.body.lokasi || null;
  const tipe = req.body.tipe || 'full_time';
  const persyaratan = req.body.persyaratan || null;
  const gaji = req.body.gaji || null;
  const gambar = req.file ? '/images/' + req.file.filename : null;

  db.query(
    'INSERT INTO lowongan (admin_id, judul, perusahaan, lokasi, tipe, deskripsi, persyaratan, gaji, deadline, gambar, link, is_active) VALUES (?,?,?,?,?,?,?,?,?,?,?,1)',
    [req.session.adminId, judul, perusahaan, lokasi, tipe, deskripsi, persyaratan, gaji, deadline || null, gambar, link || null],
    (err) => {
      if (err) {
        console.error('DB error store lowongan:', err);
        return res.render('admin/lowongan-form', {
          title: 'Tambah Lowongan', adminName: req.session.adminName,
          lowongan: req.body, error: 'Gagal menyimpan lowongan.',
        });
      }
      req.session.flash_success = 'Lowongan berhasil ditambahkan.';
      res.redirect('/admin/lowongan');
    }
  );
};

/* ── GET /admin/lowongan/:id/edit ── */
exports.showEdit = (req, res) => {
  db.query('SELECT * FROM lowongan WHERE id = ?', [req.params.id], (err, rows) => {
    if (err || rows.length === 0) return res.redirect('/admin/lowongan');
    res.render('admin/lowongan-form', {
      title    : 'Edit Lowongan',
      adminName: req.session.adminName,
      lowongan : rows[0],
      error    : null,
    });
  });
};

/* ── POST /admin/lowongan/:id/edit ── */
exports.update = (req, res) => {
  const { judul, deskripsi, deadline, link } = req.body;
  const perusahaan = req.body.perusahaan || '-';
  const lokasi = req.body.lokasi || null;
  const tipe = req.body.tipe || 'full_time';
  const persyaratan = req.body.persyaratan || null;
  const gaji = req.body.gaji || null;
  
  let sql, params;
  if (req.file) {
    const gambar = '/images/' + req.file.filename;
    sql    = 'UPDATE lowongan SET judul=?, perusahaan=?, lokasi=?, tipe=?, deskripsi=?, persyaratan=?, gaji=?, deadline=?, link=?, gambar=? WHERE id=?';
    params = [judul, perusahaan, lokasi, tipe, deskripsi, persyaratan, gaji, deadline||null, link||null, gambar, req.params.id];
  } else {
    sql    = 'UPDATE lowongan SET judul=?, perusahaan=?, lokasi=?, tipe=?, deskripsi=?, persyaratan=?, gaji=?, deadline=?, link=? WHERE id=?';
    params = [judul, perusahaan, lokasi, tipe, deskripsi, persyaratan, gaji, deadline||null, link||null, req.params.id];
  }

  db.query(sql, params, (err) => {
    if (err) {
      console.error('DB error update lowongan:', err);
      return res.render('admin/lowongan-form', {
        title: 'Edit Lowongan', adminName: req.session.adminName,
        lowongan: { ...req.body, id: req.params.id }, error: 'Gagal memperbarui lowongan.',
      });
    }
    req.session.flash_success = 'Lowongan berhasil diperbarui.';
    res.redirect('/admin/lowongan');
  });
};

/* ── POST /admin/lowongan/:id/hapus ── */
exports.destroy = (req, res) => {
  db.query('DELETE FROM lowongan WHERE id = ?', [req.params.id], (err) => {
    req.session.flash_success = err ? null : 'Lowongan berhasil dihapus.';
    req.session.flash_error   = err ? 'Gagal menghapus.' : null;
    res.redirect('/admin/lowongan');
  });
};

/* ── POST /admin/lowongan/:id/toggle ── */
exports.toggleStatus = (req, res) => {
  db.query('UPDATE lowongan SET is_active = NOT is_active WHERE id = ?', [req.params.id], () => {
    res.redirect('/admin/lowongan');
  });
};

/* ── GET /admin/lowongan/akses ── */
exports.listAccess = (req, res) => {
  db.query(
    `SELECT la.*, l.judul AS nama_lowongan, l.perusahaan
     FROM lowongan_access la
     JOIN lowongan l ON l.id = la.lowongan_id
     ORDER BY la.created_at DESC`,
    [],
    (err, rows) => {
      if (err) {
        console.error('Error fetching job access logs:', err);
        return res.status(500).send('DB error');
      }
      res.render('admin/lowongan-akses', {
        title: 'Log Akses Lowongan',
        adminName: req.session.adminName,
        logs: rows || [],
      });
    }
  );
};
