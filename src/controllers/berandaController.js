const db = require('../configs/db');

const getBerandaPage = (req, res) => {
  // 1. Query: Total Alumni Aktif
  const totalAlumniQ = new Promise((resolve) => {
    db.query(
      `SELECT COUNT(*) AS total FROM alumni WHERE is_active = 1`,
      (err, rows) => {
        resolve(err ? 0 : (rows && rows[0] ? rows[0].total : 0));
      }
    );
  });

  // 2. Query: Metrik Status Pekerjaan
  const statusQ = new Promise((resolve) => {
    db.query(
      `SELECT status_pekerjaan, COUNT(*) AS total FROM tracer_study GROUP BY status_pekerjaan`,
      (err, rows) => {
        const counts = { bekerja: 0, wirausaha: 0, kuliah: 0, belum_bekerja: 0 };
        if (!err && rows) {
          rows.forEach((row) => {
            if (row.status_pekerjaan && counts[row.status_pekerjaan] !== undefined) {
              counts[row.status_pekerjaan] = row.total;
            }
          });
        }
        resolve(counts);
      }
    );
  });

  // 3. Query: Tren Keterserapan Kerja per Tahun Lulus (Persentase Bekerja & Wirausaha)
  const trendQ = new Promise((resolve) => {
    db.query(
      `SELECT 
        a.tahun_lulus,
        COUNT(a.id) AS total_alumni,
        SUM(CASE WHEN t.status_pekerjaan IN ('bekerja', 'wirausaha') THEN 1 ELSE 0 END) AS bekerja_wirausaha
       FROM alumni a
       LEFT JOIN (
         SELECT ts1.* FROM tracer_study ts1
         INNER JOIN (
           SELECT alumni_id, MAX(tanggal_isi) AS max_date 
           FROM tracer_study 
           GROUP BY alumni_id
         ) ts2 ON ts1.alumni_id = ts2.alumni_id AND ts1.tanggal_isi = ts2.max_date
       ) t ON a.id = t.alumni_id
       WHERE a.tahun_lulus IS NOT NULL AND a.is_active = 1
       GROUP BY a.tahun_lulus
       ORDER BY a.tahun_lulus ASC`,
      (err, rows) => {
        if (err || !rows || rows.length === 0) {
          // Fallback ke default kosong jika database benar-benar kosong
          resolve({ labels: [], percentages: [] });
        } else {
          const labels = [];
          const percentages = [];
          rows.forEach((r) => {
            labels.push(r.tahun_lulus.toString());
            const percent = r.total_alumni > 0 ? Math.round((r. bekerja_wirausaha / r.total_alumni) * 100) : 0;
            percentages.push(percent);
          });
          resolve({ labels, percentages });
        }
      }
    );
  });

  // 4. Query: Rata-rata/Modus Masa Tunggu Kerja
  const masaTungguQ = new Promise((resolve) => {
    db.query(
      `SELECT lama_mencari_kerja, COUNT(*) AS total 
       FROM tracer_study 
       WHERE lama_mencari_kerja IS NOT NULL AND lama_mencari_kerja != '' 
       GROUP BY lama_mencari_kerja 
       ORDER BY total DESC 
       LIMIT 1`,
      (err, rows) => {
        if (!err && rows && rows.length > 0 && rows[0].lama_mencari_kerja) {
          resolve(rows[0].lama_mencari_kerja);
        } else {
          resolve('< 3 Bulan');
        }
      }
    );
  });

  // 5. Query: Rata-rata Kepuasan Layanan (Agregasi 1-5 diubah ke persentase)
  const kepuasanQ = new Promise((resolve) => {
    db.query(
      `SELECT AVG(kepuasan_layanan) AS avg_kepuasan 
       FROM tracer_study 
       WHERE kepuasan_layanan IS NOT NULL`,
      (err, rows) => {
        if (!err && rows && rows[0] && rows[0].avg_kepuasan) {
          const avg = parseFloat(rows[0].avg_kepuasan);
          resolve(Math.round((avg / 5) * 100) + '%');
        } else {
          resolve('100%');
        }
      }
    );
  });

  // 6. Query: Konselor Karir Aktif (Dikelola oleh Admin)
  const konselorQ = new Promise((resolve) => {
    db.query(
      `SELECT id, nama, bidang_keahlian, foto, whatsapp FROM konselor WHERE is_active = 1 ORDER BY id ASC`,
      [],
      (err, rows) => {
        resolve(err ? [] : (rows || []));
      }
    );
  });

  Promise.all([totalAlumniQ, statusQ, trendQ, masaTungguQ, kepuasanQ, konselorQ])
    .then(([totalAlumni, counts, trend, avgMasaTunggu, avgKepuasan, konselors]) => {
      const statistik = {
        totalAlumni,
        alumniBekerja: counts.bekerja,
        alumniWirausaha: counts.wirausaha,
        melanjutkanStudi: counts.kuliah,
      };

      // Tentukan puncak keterserapan kerja dari data tren kelulusan
      let maxAbs = 0;
      let peakYear = '';
      if (trend.percentages && trend.percentages.length > 0) {
        maxAbs = Math.max(...trend.percentages);
        const maxIdx = trend.percentages.indexOf(maxAbs);
        peakYear = trend.labels[maxIdx];
      }

      res.render('beranda', {
        title: 'Beranda',
        activeNav: 'beranda',
        statistik,
        trend,
        konselors,
        metrics: {
          peakAbsorption: maxAbs > 0 ? `${maxAbs}% (${peakYear})` : '0%',
          avgMasaTunggu,
          avgKepuasan
        }
      });
    })
    .catch((error) => {
      console.error('Error beranda:', error);
      res.status(500).send('Terjadi kesalahan server.');
    });
};

module.exports = { getBerandaPage };