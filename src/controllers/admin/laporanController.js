const db = require('../../configs/db');

/* ── GET /admin/laporan ── */
exports.index = (req, res) => {
  res.render('admin/laporan', {
    title: 'Laporan',
    adminName: req.session.adminName,
  });
};

/* ── GET /admin/laporan/preview ── */
exports.preview = (req, res) => {
  const type = req.query.type || 'tracer';

  if (type === 'konseling') {
    db.query(
      `SELECT pk.nama_alumni AS nama, pk.nim, pk.tahun_lulus, k.nama AS konselor, pk.topik, pk.status, pk.created_at
       FROM permintaan_konseling pk
       LEFT JOIN konselor k ON k.id = pk.konselor_id
       ORDER BY pk.created_at DESC
       LIMIT 50`,
      [],
      (err, rows) => {
        if (err) console.error('DB error laporan preview (konseling):', err.message);
        db.query(`SELECT COUNT(*) AS total FROM permintaan_konseling`, [], (e2, r2) => {
          res.render('admin/laporan-preview', {
            title: 'Pratinjau Hasil Ekspor',
            adminName: req.session.adminName,
            type,
            data: rows || [],
            totalResponden: (r2 && r2[0] && r2[0].total) || 0,
          });
        });
      }
    );
  } else if (type === 'lowongan') {
    db.query(
      `SELECT la.nama, la.nim, la.email, la.no_hp, l.judul AS nama_lowongan, l.perusahaan, la.created_at
       FROM lowongan_access la
       JOIN lowongan l ON l.id = la.lowongan_id
       ORDER BY la.created_at DESC
       LIMIT 50`,
      [],
      (err, rows) => {
        if (err) console.error('DB error laporan preview (lowongan):', err.message);
        db.query(`SELECT COUNT(*) AS total FROM lowongan_access`, [], (e2, r2) => {
          res.render('admin/laporan-preview', {
            title: 'Pratinjau Hasil Ekspor',
            adminName: req.session.adminName,
            type,
            data: rows || [],
            totalResponden: (r2 && r2[0] && r2[0].total) || 0,
          });
        });
      }
    );
  } else {
    db.query(
      `SELECT a.nim, a.nama, a.tahun_lulus, ts.periode, ts.pengisian_ke,
              ts.status_pekerjaan, ts.nama_perusahaan, ts.jabatan, ts.gaji_pertama
       FROM alumni a
       LEFT JOIN tracer_study ts ON ts.alumni_id = a.id
         AND ts.id = (SELECT t2.id FROM tracer_study t2 WHERE t2.alumni_id = a.id ORDER BY t2.tanggal_isi DESC LIMIT 1)
       ORDER BY a.tahun_lulus DESC, a.nama ASC
       LIMIT 50`,
      [],
      (err, rows) => {
        if (err) console.error('DB error laporan preview (tracer):', err.message);
        db.query(`SELECT COUNT(*) AS total FROM alumni WHERE is_active = 1`, [], (e2, r2) => {
          res.render('admin/laporan-preview', {
            title: 'Pratinjau Hasil Ekspor',
            adminName: req.session.adminName,
            type,
            data: rows || [],
            totalResponden: (r2 && r2[0] && r2[0].total) || 0,
          });
        });
      }
    );
  }
};

/* ── GET /admin/laporan/export/tracer ── */
exports.exportTracer = (req, res) => {
  db.query(
    `SELECT a.nim, a.nama, a.email, a.tahun_lulus, ts.status_pekerjaan, ts.nama_perusahaan,
            ts.jabatan, ts.gaji_pertama, ts.kesesuaian_bidang, ts.tanggal_isi
     FROM alumni a LEFT JOIN tracer_study ts ON ts.alumni_id = a.id
     ORDER BY a.tahun_lulus DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).send('Export error');
      const headers = ['NIM','Nama','Email','Tahun Lulus','Status','Perusahaan/Instansi','Posisi','Gaji','Kesesuaian Bidang','Tanggal Isi'];
      const body = (rows || []).map(r => [
        r.nim, r.nama, r.email, r.tahun_lulus || '', r.status_pekerjaan || 'Belum Mengisi',
        r.nama_perusahaan || '-', r.jabatan || '-', r.gaji_pertama || '-',
        r.kesesuaian_bidang || '-', r.tanggal_isi || '-',
      ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(','));
      const csv = [headers.join(','), ...body].join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="Laporan_Tracer_Study.csv"');
      res.send('\uFEFF' + csv);
    }
  );
};

/* ── GET /admin/laporan/export/konseling ── */
exports.exportKonseling = (req, res) => {
  db.query(
    `SELECT pk.nama_alumni, pk.nim, pk.tahun_lulus, k.nama AS konselor, pk.topik, pk.status, pk.created_at
     FROM permintaan_konseling pk LEFT JOIN konselor k ON k.id = pk.konselor_id
     ORDER BY pk.created_at DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).send('Export error');
      const headers = ['Nama Alumni','NIM','Tahun Lulus','Konselor','Topik','Status','Tanggal'];
      const body = (rows || []).map(r => [
        r.nama_alumni, r.nim || '', r.tahun_lulus || '', r.konselor || '-', r.topik, r.status, r.created_at,
      ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(','));
      const csv = [headers.join(','), ...body].join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="Laporan_Konseling_Karir.csv"');
      res.send('\uFEFF' + csv);
    }
  );
};

/* ── GET /admin/laporan/export/lowongan ── */
exports.exportLowongan = (req, res) => {
  db.query(
    `SELECT l.judul, l.perusahaan, l.lokasi, l.tipe, l.deadline, l.is_active, l.created_at
     FROM lowongan l ORDER BY l.created_at DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).send('Export error');
      const headers = ['Judul','Perusahaan','Lokasi','Tipe','Deadline','Status','Dibuat'];
      const body = (rows || []).map(r => [
        r.judul, r.perusahaan, r.lokasi || '-', r.tipe, r.deadline || '-',
        r.is_active ? 'Aktif' : 'Nonaktif', r.created_at,
      ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(','));
      const csv = [headers.join(','), ...body].join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="Laporan_Lowongan_Kerja.csv"');
      res.send('\uFEFF' + csv);
    }
  );
};
