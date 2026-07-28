/**
 * Admin Dashboard Controller
 * Data lengkap untuk dashboard sesuai desain screenshot
 */
const db = require('../../configs/db');

exports.showDashboard = (req, res) => {
  const queries = {
    totalAlumni  : 'SELECT COUNT(DISTINCT id) AS total FROM alumni WHERE is_active = 1',
    sudahIsiTracer: 'SELECT COUNT(DISTINCT alumni_id) AS total FROM tracer_study',
    bekerja      : "SELECT COUNT(DISTINCT alumni_id) AS total FROM (SELECT alumni_id, status_pekerjaan FROM tracer_study ts1 WHERE id = (SELECT MAX(id) FROM tracer_study ts2 WHERE ts2.alumni_id = ts1.alumni_id)) sub WHERE sub.status_pekerjaan = 'bekerja'",
    wirausaha    : "SELECT COUNT(DISTINCT alumni_id) AS total FROM (SELECT alumni_id, status_pekerjaan FROM tracer_study ts1 WHERE id = (SELECT MAX(id) FROM tracer_study ts2 WHERE ts2.alumni_id = ts1.alumni_id)) sub WHERE sub.status_pekerjaan = 'wirausaha'",
    kuliah       : "SELECT COUNT(DISTINCT alumni_id) AS total FROM (SELECT alumni_id, status_pekerjaan FROM tracer_study ts1 WHERE id = (SELECT MAX(id) FROM tracer_study ts2 WHERE ts2.alumni_id = ts1.alumni_id)) sub WHERE sub.status_pekerjaan = 'kuliah'",
    belumBekerja : "SELECT COUNT(DISTINCT alumni_id) AS total FROM (SELECT alumni_id, status_pekerjaan FROM tracer_study ts1 WHERE id = (SELECT MAX(id) FROM tracer_study ts2 WHERE ts2.alumni_id = ts1.alumni_id)) sub WHERE sub.status_pekerjaan = 'belum_bekerja'",
    lowonganAktif: 'SELECT COUNT(*) AS total FROM lowongan_access',
    konselingAktif: 'SELECT (SELECT COUNT(*) FROM konseling_booking) + (SELECT COUNT(*) FROM permintaan_konseling) AS total',
  };

  const promises = Object.entries(queries).map(([key, sql]) =>
    new Promise((resolve, reject) => {
      db.query(sql, (err, rows) => {
        if (err) reject(err);
        else resolve({ key, value: rows[0].total });
      });
    })
  );

  // Alumni terbaru
  const recentAlumniPromise = new Promise((resolve, reject) => {
    db.query(
      'SELECT id, nim, nama, email, tahun_lulus, created_at FROM alumni ORDER BY created_at DESC LIMIT 5',
      (err, rows) => { if (err) reject(err); else resolve(rows); }
    );
  });

  // Tracer terbaru (respon terbaru)
  const recentTracerPromise = new Promise((resolve, reject) => {
    db.query(
      `SELECT ts.id, a.nama, a.nim, a.tahun_lulus, ts.status_pekerjaan, ts.nama_perusahaan, ts.tanggal_isi
       FROM tracer_study ts JOIN alumni a ON a.id = ts.alumni_id
       ORDER BY ts.tanggal_isi DESC LIMIT 5`,
      (err, rows) => { if (err) reject(err); else resolve(rows); }
    );
  });

  // Distribusi masa tunggu kerja
  const masaTungguPromise = new Promise((resolve) => {
    db.query(
      `SELECT lama_mencari_kerja, COUNT(*) AS total
       FROM tracer_study
       WHERE status_pekerjaan IN ('bekerja','wirausaha')
         AND lama_mencari_kerja IS NOT NULL
       GROUP BY lama_mencari_kerja`,
      (err, rows) => { resolve(err ? [] : rows); }
    );
  });

  // Distribusi kesesuaian bidang
  const kesesuaianPromise = new Promise((resolve) => {
    db.query(
      `SELECT kesesuaian_bidang, COUNT(*) AS total
       FROM tracer_study
       WHERE kesesuaian_bidang IS NOT NULL
       GROUP BY kesesuaian_bidang`,
      (err, rows) => { resolve(err ? [] : rows); }
    );
  });

  Promise.all([...promises, recentAlumniPromise, recentTracerPromise, masaTungguPromise, kesesuaianPromise])
    .then(results => {
      const stat = {};
      results.slice(0, promises.length).forEach(r => { stat[r.key] = r.value; });
      const recentAlumni = results[promises.length];
      const recentTracer  = results[promises.length + 1];
      const masaTunggu    = results[promises.length + 2];
      const kesesuaian    = results[promises.length + 3];

      // Hitung persentase
      stat.persentaseTracer = stat.totalAlumni > 0
        ? Math.round((stat.sudahIsiTracer / stat.totalAlumni) * 100)
        : 0;

      stat.belumIsiTracer = stat.totalAlumni - stat.sudahIsiTracer;

      // Hitung persentase masa tunggu
      const totalBekerja = stat.bekerja + stat.wirausaha;
      const masaTungguMap = {};
      masaTunggu.forEach(r => {
        masaTungguMap[r.lama_mencari_kerja] = r.total;
      });

      // Hitung persentase kesesuaian
      const kesesuaianMap = {};
      kesesuaian.forEach(r => {
        if (r.kesesuaian_bidang) {
          const key = r.kesesuaian_bidang.toLowerCase().replace(/_/g, ' ').trim();
          kesesuaianMap[key] = (kesesuaianMap[key] || 0) + r.total;
        }
      });
      const totalKesesuaian = kesesuaian.reduce((s, r) => s + r.total, 0);

      const kesesuaianData = [
        { label: 'Sangat Sesuai', total: kesesuaianMap['sangat sesuai'] || 0 },
        { label: 'Sesuai',        total: kesesuaianMap['sesuai'] || 0 },
        { label: 'Kurang Sesuai', total: kesesuaianMap['kurang sesuai'] || 0 },
        { label: 'Tidak Sesuai',  total: kesesuaianMap['tidak sesuai'] || 0 }
      ];

      kesesuaianData.forEach(item => {
        item.pct = totalKesesuaian > 0 ? Math.round((item.total / totalKesesuaian) * 100) : 0;
      });

      // Masa tunggu default categories
      const masaTungguData = [
        {
          label: '< 3 Bulan',
          total: masaTungguMap['< 3 bulan'] || masaTungguMap['Kurang dari 3 bulan'] || 0,
        },
        {
          label: '3 – 6 Bulan',
          total: masaTungguMap['3-6 bulan'] || masaTungguMap['3 - 6 bulan'] || 0,
        },
        {
          label: '6 – 12 Bulan',
          total: masaTungguMap['6-12 bulan'] || masaTungguMap['6 - 12 bulan'] || 0,
        },
        {
          label: '> 12 Bulan',
          total: masaTungguMap['> 12 bulan'] || masaTungguMap['Lebih dari 12 bulan'] || 0,
        },
      ];

      const maxMasa = Math.max(...masaTungguData.map(d => d.total), 1);
      masaTungguData.forEach(d => {
        d.pct = Math.round((d.total / maxMasa) * 100);
      });

      res.render('admin/dashboard', {
        title        : 'Dashboard Admin',
        adminName    : req.session.adminName,
        stat,
        recentAlumni,
        recentTracer,
        masaTungguData,
        kesesuaianData,
      });
    })
    .catch(err => {
      console.error('Dashboard error:', err);
      res.status(500).send('Terjadi kesalahan server.');
    });
};
