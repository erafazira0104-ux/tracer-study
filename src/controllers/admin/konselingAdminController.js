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
      
      db.query(
        'SELECT kunci, nilai FROM tracer_pengaturan WHERE kunci IN ("template_wa_konseling", "whatsapp_admin")',
        [],
        (errTemplate, tRows) => {
          const defaultTemplate = `Assalamualaikum/Selamat pagi, {SAPAAN_KONSELOR} {NAMA_KONSELOR}.

Mohon maaf mengganggu waktunya, {SAPAAN_PENDEK}. Perkenalkan, saya {NAMA_ALUMNI}, alumni angkatan {TAHUN_LULUS}. Dengan hormat, saya ingin menyampaikan bahwa saya telah mengajukan permohonan konseling melalui Tracer Study.

Mohon kiranya {SAPAAN_KONSELOR} berkenan memberikan arahan mengenai proses atau langkah selanjutnya yang perlu saya lakukan. Atas perhatian dan kesediaan {SAPAAN_KONSELOR}, saya ucapkan terima kasih banyak.

Wassalamualaikum/Hormat saya,
{NAMA_ALUMNI}`;

          let waTemplate = defaultTemplate;
          let waAdmin = '081936791163';

          if (!errTemplate && tRows && tRows.length > 0) {
            tRows.forEach(r => {
              if (r.kunci === 'template_wa_konseling') waTemplate = r.nilai;
              if (r.kunci === 'whatsapp_admin') waAdmin = r.nilai;
            });
          }

          res.render('admin/konseling', {
            title: 'Konselor Karir',
            adminName: req.session.adminName,
            konselorList: rows || [],
            waTemplate: waTemplate,
            whatsappAdmin: waAdmin,
          });
        }
      );
    }
  );
};

/* ── POST /admin/konseling/template-wa ── */
exports.updateTemplateWa = (req, res) => {
  const { template_wa } = req.body;
  if (!template_wa || !template_wa.trim()) {
    req.session.flash_error = 'Template pesan WhatsApp tidak boleh kosong.';
    return res.redirect('/admin/konseling');
  }

  db.query(
    `INSERT INTO tracer_pengaturan (kunci, nilai, keterangan)
     VALUES ('template_wa_konseling', ?, 'Template pesan otomatis WhatsApp saat alumni mengajukan konseling karir')
     ON DUPLICATE KEY UPDATE nilai = VALUES(nilai)`,
    [template_wa.trim()],
    (err) => {
      if (err) {
        console.error('DB error updating WA template:', err.message);
        req.session.flash_error = 'Gagal menyimpan template WhatsApp.';
      } else {
        req.session.flash_success = 'Template pesan WhatsApp konselor berhasil diperbarui.';
      }
      res.redirect('/admin/konseling');
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
      res.redirect('/admin/konseling/booking');
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
  const { nama, bidang_keahlian, whatsapp } = req.body;
  const foto = req.file ? '/images/' + req.file.filename : null;

  if (!nama || !bidang_keahlian) {
    return res.render('admin/tambah-konselor', {
      title: 'Tambah Konselor',
      adminName: req.session.adminName,
      error: 'Nama konselor dan bidang keahlian wajib diisi.',
    });
  }

  const cleanWhatsapp = whatsapp ? whatsapp.trim().replace(/[^0-9]/g, '') : null;

  db.query(
    'INSERT INTO konselor (nama, bidang_keahlian, whatsapp, foto) VALUES (?, ?, ?, ?)',
    [nama.trim(), bidang_keahlian.trim(), cleanWhatsapp, foto],
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

/* ── GET /admin/konseling/edit/:id ── */
exports.showEditKonselor = (req, res) => {
  const { id } = req.params;
  db.query('SELECT * FROM konselor WHERE id = ?', [id], (err, rows) => {
    if (err || rows.length === 0) {
      req.session.flash_error = 'Data konselor tidak ditemukan.';
      return res.redirect('/admin/konseling');
    }
    res.render('admin/edit-konselor', {
      title: 'Edit Konselor',
      adminName: req.session.adminName,
      konselor: rows[0],
      error: null,
    });
  });
};

/* ── POST /admin/konseling/edit/:id ── */
exports.updateKonselor = (req, res) => {
  const { id } = req.params;
  const { nama, bidang_keahlian, whatsapp, hapus_foto } = req.body;
  const newFoto = req.file ? '/images/' + req.file.filename : null;

  if (!nama || !bidang_keahlian) {
    db.query('SELECT * FROM konselor WHERE id = ?', [id], (err, rows) => {
      return res.render('admin/edit-konselor', {
        title: 'Edit Konselor',
        adminName: req.session.adminName,
        konselor: rows[0] || {},
        error: 'Nama konselor dan bidang keahlian wajib diisi.',
      });
    });
    return;
  }

  const cleanWhatsapp = whatsapp ? whatsapp.trim().replace(/[^0-9]/g, '') : null;

  // Build query dynamically based on whether foto is being updated
  let sql, params;
  if (newFoto) {
    sql = 'UPDATE konselor SET nama=?, bidang_keahlian=?, whatsapp=?, foto=? WHERE id=?';
    params = [nama.trim(), bidang_keahlian.trim(), cleanWhatsapp, newFoto, id];
  } else if (hapus_foto === '1') {
    sql = 'UPDATE konselor SET nama=?, bidang_keahlian=?, whatsapp=?, foto=NULL WHERE id=?';
    params = [nama.trim(), bidang_keahlian.trim(), cleanWhatsapp, id];
  } else {
    sql = 'UPDATE konselor SET nama=?, bidang_keahlian=?, whatsapp=? WHERE id=?';
    params = [nama.trim(), bidang_keahlian.trim(), cleanWhatsapp, id];
  }

  db.query(sql, params, (err) => {
    if (err) {
      console.error('DB error update konselor:', err.message);
      req.session.flash_error = 'Gagal memperbarui data konselor.';
    } else {
      req.session.flash_success = 'Data konselor berhasil diperbarui.';
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

