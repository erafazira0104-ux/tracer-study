const db = require('../../configs/db');

/* ── GET /admin/grafik ── */
exports.index = (req, res) => {
  const statusQ = new Promise((resolve) => {
    db.query(
      `SELECT status_pekerjaan, COUNT(*) AS total FROM tracer_study GROUP BY status_pekerjaan`,
      [], (err, rows) => resolve(err ? [] : rows)
    );
  });

  const kesesuaianQ = new Promise((resolve) => {
    db.query(
      `SELECT kesesuaian_bidang, COUNT(*) AS total FROM tracer_study WHERE kesesuaian_bidang IS NOT NULL GROUP BY kesesuaian_bidang`,
      [], (err, rows) => {
        const buckets = { 'Sangat Sesuai': 0, 'Sesuai': 0, 'Kurang Sesuai': 0, 'Tidak Sesuai': 0 };
        (rows || []).forEach(r => {
          const k = r.kesesuaian_bidang ? r.kesesuaian_bidang.trim() : 'Tidak Sesuai';
          if (buckets[k] !== undefined) {
            buckets[k] += r.total;
          } else {
            if (k.toLowerCase().includes('sangat')) buckets['Sangat Sesuai'] += r.total;
            else if (k.toLowerCase().includes('kurang')) buckets['Kurang Sesuai'] += r.total;
            else if (k.toLowerCase().includes('tidak')) buckets['Tidak Sesuai'] += r.total;
            else buckets['Sesuai'] += r.total;
          }
        });
        const formatted = Object.keys(buckets).map(label => ({ kesesuaian_bidang: label, total: buckets[label] }));
        resolve(formatted);
      }
    );
  });

  const masaTungguQ = new Promise((resolve) => {
    db.query(
      `SELECT lama_mencari_kerja, COUNT(*) AS total FROM tracer_study WHERE lama_mencari_kerja IS NOT NULL GROUP BY lama_mencari_kerja`,
      [], (err, rows) => {
        const buckets = {
          '< 1 Bulan': 0,
          '1 - 3 Bulan': 0,
          '3 - 6 Bulan': 0,
          '> 6 Bulan': 0
        };
        (rows || []).forEach(r => {
          const val = r.lama_mencari_kerja ? r.lama_mencari_kerja.trim() : '1 - 3 Bulan';
          if (buckets[val] !== undefined) {
            buckets[val] += r.total;
          } else {
            const clean = parseInt(val.replace(/[^0-9]/g, ''));
            if (!isNaN(clean)) {
              if (clean < 1) buckets['< 1 Bulan'] += r.total;
              else if (clean >= 1 && clean <= 3) buckets['1 - 3 Bulan'] += r.total;
              else if (clean > 3 && clean <= 6) buckets['3 - 6 Bulan'] += r.total;
              else buckets['> 6 Bulan'] += r.total;
            } else {
              if (val.toLowerCase().includes('sebelum')) buckets['< 1 Bulan'] += r.total;
              else if (val.toLowerCase().includes('lebih')) buckets['> 6 Bulan'] += r.total;
              else buckets['1 - 3 Bulan'] += r.total;
            }
          }
        });
        const formatted = Object.keys(buckets).map(label => ({ lama_mencari_kerja: label, total: buckets[label] }));
        resolve(formatted);
      }
    );
  });

  const trendQ = new Promise((resolve) => {
    db.query(
      `SELECT tahun_lulus, COUNT(*) AS total FROM alumni WHERE tahun_lulus IS NOT NULL GROUP BY tahun_lulus ORDER BY tahun_lulus ASC`,
      [], (err, rows) => resolve(err ? [] : rows)
    );
  });

  const gajiQ = new Promise((resolve) => {
    db.query(
      `SELECT gaji_pertama, COUNT(*) AS total FROM tracer_study WHERE gaji_pertama IS NOT NULL GROUP BY gaji_pertama`,
      [], (err, rows) => {
        const buckets = {
          '< Rp 1.500.000': 0,
          'Rp 1.500.000 - Rp 3.000.000': 0,
          'Rp 3.000.000 - Rp 5.000.000': 0,
          '> Rp 5.000.000': 0
        };
        (rows || []).forEach(r => {
          const val = r.gaji_pertama ? r.gaji_pertama.trim() : 'Rp 1.500.000 - Rp 3.000.000';
          if (buckets[val] !== undefined) {
            buckets[val] += r.total;
          } else {
            const clean = parseInt(val.replace(/[^0-9]/g, ''));
            if (!isNaN(clean)) {
              if (clean < 1500000) buckets['< Rp 1.500.000'] += r.total;
              else if (clean >= 1500000 && clean <= 3000000) buckets['Rp 1.500.000 - Rp 3.000.000'] += r.total;
              else if (clean > 3000000 && clean <= 5000000) buckets['Rp 3.000.000 - Rp 5.000.000'] += r.total;
              else buckets['> Rp 5.000.000'] += r.total;
            } else {
              buckets['Rp 1.500.000 - Rp 3.000.000'] += r.total;
            }
          }
        });
        const formatted = Object.keys(buckets).map(label => ({ gaji_pertama: label, total: buckets[label] }));
        resolve(formatted);
      }
    );
  });

  const totalAlumniQ = new Promise((resolve) => {
    db.query(`SELECT COUNT(*) AS total FROM alumni WHERE is_active = 1`, [], (err, rows) => resolve(err ? 0 : rows[0].total));
  });

  const totalIsiQ = new Promise((resolve) => {
    db.query(`SELECT COUNT(*) AS total FROM tracer_study`, [], (err, rows) => resolve(err ? 0 : rows[0].total));
  });

  Promise.all([statusQ, kesesuaianQ, masaTungguQ, trendQ, gajiQ, totalAlumniQ, totalIsiQ])
    .then(([status, kesesuaian, masaTunggu, trend, gaji, totalAlumni, totalIsi]) => {
      const counts = { bekerja: 0, wirausaha: 0, kuliah: 0, belum_bekerja: 0 };
      (status || []).forEach(s => {
        if (s.status_pekerjaan && counts[s.status_pekerjaan] !== undefined) {
          counts[s.status_pekerjaan] = s.total;
        }
      });

      res.render('admin/grafik', {
        title: 'Grafik & Statistik',
        adminName: req.session.adminName,
        status, counts, kesesuaian, masaTunggu, trend, gaji,
        totalAlumni, totalIsi,
        partisipasi: totalAlumni > 0 ? Math.round((totalIsi / totalAlumni) * 100) : 0,
      });
    })
    .catch((err) => {
      console.error('Grafik error:', err);
      res.status(500).send('Terjadi kesalahan server.');
    });
};
