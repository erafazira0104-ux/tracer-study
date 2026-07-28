const db = require('../../configs/db');

const KATEGORI_LABEL = {
  bekerja: 'Bekerja',
  wirausaha: 'Wirausaha',
  kuliah: 'Studi Lanjut',
  belum_bekerja: 'Belum Bekerja',
  penilaian_prodi: 'Penilaian Program Studi'
};

/* ── GET /admin/tracer — daftar kategori kuesioner ── */
exports.index = (req, res) => {
  db.query(
    `SELECT tk.id, tk.slug, tk.nama AS label, tk.icon,
            COALESCE(sub.jumlah_pertanyaan, 0) AS jumlah_pertanyaan,
            COALESCE(sub.jumlah_aktif, 0) AS jumlah_aktif
     FROM tracer_kategori tk
     LEFT JOIN (
       SELECT kategori, COUNT(*) AS jumlah_pertanyaan, SUM(is_active) AS jumlah_aktif
       FROM kuesioner_pertanyaan GROUP BY kategori
     ) sub ON sub.kategori = tk.slug
     WHERE tk.is_active = 1`,
    [],
    (err, rows) => {
      if (err) console.error('DB error kuesioner index:', err.message);
      res.render('admin/tracer', {
        title: 'Tracer Study',
        adminName: req.session.adminName,
        kategoris: rows || [],
        flash_success: req.session.flash_success || null,
        flash_error: req.session.flash_error || null
      });
      delete req.session.flash_success;
      delete req.session.flash_error;
    }
  );
};

/* ── GET /admin/tracer/:kategori — kelola pertanyaan per kategori ── */
exports.kelolaKategori = (req, res) => {
  const kategori = req.params.kategori;

  db.query(
    'SELECT * FROM tracer_kategori WHERE slug = ? AND is_active = 1',
    [kategori],
    (e1, catRows) => {
      if (e1 || catRows.length === 0) return res.redirect('/admin/tracer');
      const cat = catRows[0];

      db.query(
        `SELECT * FROM kuesioner_pertanyaan WHERE kategori = ? ORDER BY urutan ASC, id ASC`,
        [kategori],
        (err, rows) => {
          if (err) console.error('DB error kelolaKategori:', err.message);
          res.render('admin/tracer-detail', {
            title: 'Kelola Pertanyaan',
            adminName: req.session.adminName,
            kategori,
            kategoriLabel: cat.nama,
            pertanyaanList: rows || [],
          });
        }
      );
    }
  );
};

/* ── POST /admin/tracer/pertanyaan — tambah pertanyaan baru ── */
exports.tambahPertanyaan = (req, res) => {
  const { kategori, pertanyaan, jenis_jawaban, status_aktif } = req.body;
  let opsi = null;

  if (jenis_jawaban === 'pilihan_ganda') {
    const opsiArr = [].concat(req.body.opsi || []).map((o) => (o || '').trim()).filter(Boolean);
    opsi = JSON.stringify(opsiArr);
  }

  if (!kategori || !pertanyaan) {
    return res.redirect('/admin/tracer');
  }

  db.query(
    'SELECT 1 FROM tracer_kategori WHERE slug = ? AND is_active = 1',
    [kategori],
    (e1, exists) => {
      if (e1 || exists.length === 0) return res.redirect('/admin/tracer');

      db.query(
        `SELECT COALESCE(MAX(urutan),0)+1 AS next FROM kuesioner_pertanyaan WHERE kategori = ?`,
        [kategori],
        (e2, r2) => {
          const urutan = (r2 && r2[0] && r2[0].next) || 1;
          db.query(
            `INSERT INTO kuesioner_pertanyaan (kategori, pertanyaan, jenis_jawaban, opsi_jawaban, is_active, urutan)
             VALUES (?,?,?,?,?,?)`,
            [kategori, pertanyaan.trim(), jenis_jawaban === 'pilihan_ganda' ? 'pilihan_ganda' : 'essay',
              opsi, status_aktif === 'nonaktif' ? 0 : 1, urutan],
            (err) => {
              if (err) console.error('DB error tambah pertanyaan:', err.message);
              res.redirect(`/admin/tracer/${kategori}`);
            }
          );
        }
      );
    }
  );
};

/* ── POST /admin/tracer/kategori/tambah ── */
exports.tambahKategori = (req, res) => {
  const { nama, icon } = req.body;
  if (!nama || !nama.trim()) {
    req.session.flash_error = 'Nama kategori wajib diisi.';
    return res.redirect('/admin/tracer');
  }

  const slug = nama.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

  db.query(
    'INSERT INTO tracer_kategori (slug, nama, icon) VALUES (?, ?, ?)',
    [slug, nama.trim(), icon || '📝'],
    (err) => {
      if (err) {
        console.error('Error adding category:', err);
        req.session.flash_error = 'Gagal menambahkan kategori. Slug mungkin sudah ada.';
      } else {
        req.session.flash_success = 'Kategori kuesioner berhasil ditambahkan.';
      }
      res.redirect('/admin/tracer');
    }
  );
};

/* ── POST /admin/tracer/pertanyaan/:id — update pertanyaan ── */
exports.updatePertanyaan = (req, res) => {
  const { id } = req.params;
  const { kategori, pertanyaan, jenis_jawaban, status_aktif } = req.body;
  let opsi = null;

  if (jenis_jawaban === 'pilihan_ganda') {
    const opsiArr = [].concat(req.body.opsi || []).map((o) => (o || '').trim()).filter(Boolean);
    opsi = JSON.stringify(opsiArr);
  }

  db.query(
    `UPDATE kuesioner_pertanyaan
     SET pertanyaan = ?, jenis_jawaban = ?, opsi_jawaban = ?, is_active = ?
     WHERE id = ?`,
    [pertanyaan.trim(), jenis_jawaban === 'pilihan_ganda' ? 'pilihan_ganda' : 'essay',
      opsi, status_aktif === 'nonaktif' ? 0 : 1, id],
    (err) => {
      if (err) console.error('DB error update pertanyaan:', err.message);
      res.redirect(`/admin/tracer/${kategori}`);
    }
  );
};

/* ── POST /admin/tracer/pertanyaan/:id/toggle — aktif/nonaktif via AJAX ── */
exports.toggleAktif = (req, res) => {
  const { id } = req.params;
  db.query(
    `UPDATE kuesioner_pertanyaan SET is_active = NOT is_active WHERE id = ?`,
    [id],
    (err) => {
      if (err) return res.status(500).json({ ok: false, message: err.message });
      res.json({ ok: true });
    }
  );
};

/* ── POST /admin/tracer/pertanyaan/:id/hapus ── */
exports.hapusPertanyaan = (req, res) => {
  const { id } = req.params;
  const kategori = req.body.kategori || req.query.kategori;
  db.query(`DELETE FROM kuesioner_pertanyaan WHERE id = ?`, [id], (err) => {
    if (err) console.error('DB error hapus pertanyaan:', err.message);
    res.redirect(kategori ? `/admin/tracer/${kategori}` : '/admin/tracer');
  });
};

/* ── GET /admin/tracer/data — data list jawaban alumni (jika dibutuhkan) ── */
exports.dataList = (req, res) => {
  const { search, status, periode } = req.query;
  let sql = `
    SELECT ts.*, a.nama, a.nim, a.email, a.tahun_lulus,
           (SELECT COUNT(*) FROM tracer_study ts2 WHERE ts2.alumni_id = a.id) AS jumlah_pengisian
    FROM alumni a
    JOIN tracer_study ts ON ts.alumni_id = a.id
      AND ts.id = (SELECT MAX(ts3.id) FROM tracer_study ts3 WHERE ts3.alumni_id = a.id)
    WHERE 1=1`;
  const params = [];

  if (search) {
    sql += ' AND (a.nama LIKE ? OR a.nim LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  if (status) {
    sql += ' AND ts.status_pekerjaan = ?';
    params.push(status);
  }
  if (periode) {
    sql += ' AND ts.periode = ?';
    params.push(periode);
  }
  sql += ' ORDER BY ts.tanggal_isi DESC';

  // Also fetch available periods for the filter dropdown
  db.query('SELECT DISTINCT periode FROM tracer_study WHERE periode IS NOT NULL ORDER BY periode DESC', [], (errP, periodeRows) => {
    const periodeList = (periodeRows || []).map(r => r.periode);

    db.query(sql, params, (err, rows) => {
      if (err) return res.status(500).send('DB error');
      res.render('admin/tracer-data', {
        title: 'Data Tracer Study',
        adminName: req.session.adminName,
        tracers: rows,
        search: search || '',
        filterStatus: status || '',
        filterPeriode: periode || '',
        periodeList,
      });
    });
  });
};

/* ── GET /admin/tracer/detail/:id ── */
exports.show = (req, res) => {
  db.query(
    `SELECT ts.*, a.nama, a.nim, a.email, a.no_hp, a.tahun_lulus, a.angkatan, a.jenis_kelamin
     FROM tracer_study ts JOIN alumni a ON a.id = ts.alumni_id WHERE ts.id = ?`,
    [req.params.id],
    (err, rows) => {
      if (err || rows.length === 0) return res.redirect('/admin/tracer');
      const detail = rows[0];

      // Fetch all entries by the same alumni for timeline view
      db.query(
        `SELECT id, periode, pengisian_ke, status_pekerjaan, nama_perusahaan, nama_universitas, tanggal_isi
         FROM tracer_study WHERE alumni_id = ? ORDER BY tanggal_isi DESC`,
        [detail.alumni_id],
        (err2, allEntries) => {
          res.render('admin/tracer-detail', {
            title: 'Detail Tracer Study',
            adminName: req.session.adminName,
            kategori: detail.status_pekerjaan,
            kategoriLabel: KATEGORI_LABEL[detail.status_pekerjaan] || detail.status_pekerjaan,
            pertanyaanList: [],
            tracerDetail: detail,
            riwayatAlumni: allEntries || [],
          });
        }
      );
    }
  );
};

/* ── GET /admin/tracer/export ── */
exports.exportCsv = (req, res) => {
  db.query(
    `SELECT a.nim, a.nama, a.email, a.tahun_lulus, a.angkatan,
            ts.periode, ts.pengisian_ke,
            ts.status_pekerjaan, ts.nama_perusahaan, ts.jabatan, ts.bidang_perusahaan,
            ts.lokasi_perusahaan, ts.gaji_pertama, ts.lama_mencari_kerja,
            ts.kesesuaian_bidang, ts.kepuasan_layanan, ts.tanggal_isi
     FROM tracer_study ts JOIN alumni a ON a.id = ts.alumni_id
     ORDER BY ts.tanggal_isi DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).send('Export error');

      const headers = ['NIM','Nama','Email','Tahun Lulus','Angkatan','Periode','Pengisian Ke',
        'Status Pekerjaan','Perusahaan','Jabatan','Bidang','Lokasi','Gaji Pertama',
        'Lama Mencari Kerja','Kesesuaian Bidang','Kepuasan (1-5)','Tanggal Isi'];

      const rows2csv = rows.map(r => [
        r.nim, r.nama, r.email, r.tahun_lulus, r.angkatan,
        r.periode||'', r.pengisian_ke||'',
        r.status_pekerjaan,
        r.nama_perusahaan||'', r.jabatan||'', r.bidang_perusahaan||'',
        r.lokasi_perusahaan||'', r.gaji_pertama||'', r.lama_mencari_kerja||'',
        r.kesesuaian_bidang||'', r.kepuasan_layanan||'', r.tanggal_isi,
      ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(','));

      const csv = [headers.join(','), ...rows2csv].join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="tracer_study_export.csv"');
      res.send('\uFEFF' + csv);
    }
  );
};

/* ── POST /admin/tracer/kategori/:id/hapus ── */
exports.hapusKategori = (req, res) => {
  const { id } = req.params;

  db.query('SELECT slug FROM tracer_kategori WHERE id = ?', [id], (errFind, rows) => {
    if (errFind || rows.length === 0) {
      req.session.flash_error = 'Kategori tidak ditemukan.';
      return res.redirect('/admin/tracer');
    }

    const { slug } = rows[0];

    // Soft delete category
    db.query('UPDATE tracer_kategori SET is_active = 0 WHERE id = ?', [id], (errDel) => {
      if (errDel) {
        console.error('Error soft deleting category:', errDel);
        req.session.flash_error = 'Gagal menghapus kategori.';
        return res.redirect('/admin/tracer');
      }

      // Also clean up questions associated with this custom category
      db.query('DELETE FROM kuesioner_pertanyaan WHERE kategori = ?', [slug], (errQ) => {
        if (errQ) {
          console.error('Error deleting associated questions:', errQ);
        }
        req.session.flash_success = 'Kategori kuesioner berhasil dihapus.';
        res.redirect('/admin/tracer');
      });
    });
  });
};

/* ── GET /admin/tracer/periode — daftar periode pengisian ── */
exports.listPeriode = (req, res) => {
  db.query('SELECT nilai FROM tracer_pengaturan WHERE kunci = ? LIMIT 1', ['cooldown_bulan'], (errSetting, settingRows) => {
    const cooldownBulan = (settingRows && settingRows.length > 0) ? settingRows[0].nilai : '3';

    db.query('SELECT * FROM tracer_periode ORDER BY created_at DESC', [], (err, rows) => {
      if (err) console.error('DB error listPeriode:', err.message);
      
      const flash_success = req.session.flash_success || null;
      const flash_error = req.session.flash_error || null;
      delete req.session.flash_success;
      delete req.session.flash_error;

      res.render('admin/tracer-periode', {
        title: 'Kelola Periode Tracer Study',
        adminName: req.session.adminName,
        periodes: rows || [],
        cooldownBulan,
        flash_success,
        flash_error,
      });
    });
  });
};

/* ── POST /admin/tracer/periode/tambah ── */
exports.tambahPeriode = (req, res) => {
  const { nama, tanggal_mulai, tanggal_selesai } = req.body;
  if (!nama || !tanggal_mulai || !tanggal_selesai) {
    req.session.flash_error = 'Nama periode, tanggal mulai, dan tanggal selesai wajib diisi.';
    return res.redirect('/admin/tracer/periode');
  }

  const start = new Date(tanggal_mulai);
  const end = new Date(tanggal_selesai);

  if (end <= start) {
    req.session.flash_error = 'Tanggal selesai harus lebih besar dari tanggal mulai.';
    return res.redirect('/admin/tracer/periode');
  }
  
  const startStr = start.toISOString().slice(0, 19).replace('T', ' ');
  const endStr = end.toISOString().slice(0, 19).replace('T', ' ');

  db.query(
    'INSERT INTO tracer_periode (nama, tanggal_mulai, tanggal_selesai, is_active) VALUES (?, ?, ?, 0)',
    [nama, startStr, endStr],
    (err) => {
      if (err) {
        console.error('DB error tambahPeriode:', err.message);
        req.session.flash_error = 'Gagal menambahkan periode.';
      } else {
        req.session.flash_success = `Periode '${nama}' berhasil dibuat dengan masa aktif kustom.`;
      }
      res.redirect('/admin/tracer/periode');
    }
  );
};

/* ── POST /admin/tracer/periode/:id/toggle ── */
exports.togglePeriode = (req, res) => {
  const { id } = req.params;

  // Set all inactive first
  db.query('UPDATE tracer_periode SET is_active = 0', [], (err) => {
    if (err) {
      console.error('DB error deactivate periods:', err.message);
      req.session.flash_error = 'Gagal mengubah status periode.';
      return res.redirect('/admin/tracer/periode');
    }

    // Set selected active
    db.query('UPDATE tracer_periode SET is_active = 1 WHERE id = ?', [id], (err2) => {
      if (err2) {
        console.error('DB error activate period:', err2.message);
        req.session.flash_error = 'Gagal mengaktifkan periode.';
      } else {
        req.session.flash_success = 'Periode berhasil diaktifkan.';
      }
      res.redirect('/admin/tracer/periode');
    });
  });
};

/* ── POST /admin/tracer/periode/:id/hapus ── */
exports.hapusPeriode = (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM tracer_periode WHERE id = ?', [id], (err) => {
    if (err) {
      console.error('DB error hapusPeriode:', err.message);
      req.session.flash_error = 'Gagal menghapus periode.';
    } else {
      req.session.flash_success = 'Periode berhasil dihapus.';
    }
    res.redirect('/admin/tracer/periode');
  });
};

/* ── POST /admin/tracer/pengaturan/cooldown ── */
exports.updateCooldown = (req, res) => {
  const { cooldown_bulan } = req.body;
  if (!cooldown_bulan || isNaN(cooldown_bulan)) {
    req.session.flash_error = 'Nilai jeda pengisian wajib berupa angka bulan valid.';
    return res.redirect('/admin/tracer/periode');
  }

  db.query(
    "UPDATE tracer_pengaturan SET nilai = ? WHERE kunci = 'cooldown_bulan'",
    [cooldown_bulan.toString()],
    (err) => {
      if (err) {
        console.error('DB error updateCooldown:', err.message);
        req.session.flash_error = 'Gagal memperbarui pengaturan jeda pengisian.';
      } else {
        req.session.flash_success = `Pengaturan jeda pengisian ulang berhasil diperbarui menjadi ${cooldown_bulan} bulan.`;
      }
      res.redirect('/admin/tracer/periode');
    }
  );
};
