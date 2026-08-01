const db   = require('../../configs/db');
const xlsx = require('xlsx');

/* ── GET /admin/laporan ── */
exports.index = (req, res) => {
  // Ambil statistik ringkasan
  db.query(`SELECT
    (SELECT COUNT(*) FROM alumni WHERE is_active = 1) AS total_alumni,
    (SELECT COUNT(*) FROM tracer_study) AS total_tracer,
    (SELECT COUNT(*) FROM permintaan_konseling) AS total_konseling,
    (SELECT COUNT(*) FROM lowongan_access) AS total_lowongan_access
  `, [], (err, rows) => {
    const stats = (rows && rows[0]) || { total_alumni: 0, total_tracer: 0, total_konseling: 0, total_lowongan_access: 0 };
    res.render('admin/laporan', {
      title: 'Laporan',
      adminName: req.session.adminName,
      stats,
    });
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
  } else if (type === 'prodi') {
    db.query(
      `SELECT a.nim, a.nama, a.tahun_lulus,
              ts.eval_kurikulum, ts.eval_dosen, ts.eval_fasilitas, ts.kepuasan_layanan, ts.saran, ts.tanggal_isi
       FROM alumni a
       JOIN tracer_study ts ON ts.alumni_id = a.id
       ORDER BY ts.tanggal_isi DESC
       LIMIT 50`,
      [],
      (err, rows) => {
        if (err) console.error('DB error laporan preview (prodi):', err.message);
        db.query(`SELECT COUNT(*) AS total FROM tracer_study`, [], (e2, r2) => {
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
    const statusFilter = req.query.status || 'semua';
    const joinType = (statusFilter && statusFilter !== 'semua') ? 'INNER JOIN' : 'LEFT JOIN';
    let sql = `SELECT a.nim, a.nama, a.email, a.tahun_lulus, ts.*
               FROM alumni a
               ${joinType} tracer_study ts ON ts.alumni_id = a.id
                 AND ts.id = (SELECT t2.id FROM tracer_study t2 WHERE t2.alumni_id = a.id ORDER BY t2.tanggal_isi DESC LIMIT 1)`;
    const params = [];
    if (statusFilter && statusFilter !== 'semua') {
      sql += ` WHERE ts.status_pekerjaan = ?`;
      params.push(statusFilter);
    }
    sql += ` ORDER BY a.tahun_lulus DESC, a.nama ASC LIMIT 100`;

const defaultCategoryQuestions = {
  bekerja: [
    { id: 'b1', pertanyaan: 'Apakah Anda saat ini sudah bekerja?', kategori: 'bekerja' },
    { id: 'b2', pertanyaan: 'Kapan Anda mulai mencari pekerjaan?', kategori: 'bekerja' },
    { id: 'b3', pertanyaan: 'Berapa lama waktu yang dibutuhkan hingga memperoleh pekerjaan pertama?', kategori: 'bekerja' },
    { id: 'b4', pertanyaan: 'Nama Instansi/Perusahaan', kategori: 'bekerja' },
    { id: 'b5', pertanyaan: 'Jenis Instansi', kategori: 'bekerja' },
    { id: 'b6', pertanyaan: 'Bidang Usaha Instansi', kategori: 'bekerja' },
    { id: 'b7', pertanyaan: 'Jabatan Anda saat ini', kategori: 'bekerja' },
    { id: 'b8', pertanyaan: 'Lokasi Tempat Kerja', kategori: 'bekerja' },
    { id: 'b9', pertanyaan: 'Status Kepegawaian', kategori: 'bekerja' },
    { id: 'b10', pertanyaan: 'Berapa penghasilan pertama Anda?', kategori: 'bekerja' },
    { id: 'b11', pertanyaan: 'Berapa penghasilan Anda saat ini?', kategori: 'bekerja' },
    { id: 'b12', pertanyaan: 'Apakah pekerjaan Anda sesuai dengan bidang studi?', kategori: 'bekerja' },
    { id: 'b13', pertanyaan: 'Seberapa sesuai pekerjaan Anda dengan kompetensi yang diperoleh selama kuliah?', kategori: 'bekerja' }
  ],
  wirausaha: [
    { id: 'w1', pertanyaan: 'Apakah Anda memiliki usaha sendiri?', kategori: 'wirausaha' },
    { id: 'w2', pertanyaan: 'Nama Usaha', kategori: 'wirausaha' },
    { id: 'w3', pertanyaan: 'Bidang Usaha', kategori: 'wirausaha' },
    { id: 'w4', pertanyaan: 'Tahun Memulai Usaha', kategori: 'wirausaha' },
    { id: 'w5', pertanyaan: 'Jumlah Karyawan', kategori: 'wirausaha' },
    { id: 'w6', pertanyaan: 'Omzet per Bulan', kategori: 'wirausaha' },
    { id: 'w7', pertanyaan: 'Sumber Modal Usaha', kategori: 'wirausaha' },
    { id: 'w8', pertanyaan: 'Apakah usaha Anda sesuai dengan bidang studi?', kategori: 'wirausaha' },
    { id: 'w9', pertanyaan: 'Seberapa besar perkuliahan membantu usaha Anda?', kategori: 'wirausaha' }
  ],
  kuliah: [
    { id: 'k1', pertanyaan: 'Apakah Anda sedang melanjutkan pendidikan?', kategori: 'kuliah' },
    { id: 'k2', pertanyaan: 'Nama Perguruan Tinggi', kategori: 'kuliah' },
    { id: 'k3', pertanyaan: 'Jenjang Pendidikan', kategori: 'kuliah' },
    { id: 'k4', pertanyaan: 'Program Studi', kategori: 'kuliah' },
    { id: 'k5', pertanyaan: 'Tahun Masuk', kategori: 'kuliah' },
    { id: 'k6', pertanyaan: 'Alasan Melanjutkan Studi', kategori: 'kuliah' },
    { id: 'k7', pertanyaan: 'Sumber Pembiayaan', kategori: 'kuliah' }
  ],
  belum_bekerja: [
    { id: 'bb1', pertanyaan: 'Apakah Anda sedang mencari pekerjaan?', kategori: 'belum_bekerja' },
    { id: 'bb2', pertanyaan: 'Berapa kali melamar pekerjaan?', kategori: 'belum_bekerja' },
    { id: 'bb3', pertanyaan: 'Berapa kali mengikuti wawancara kerja?', kategori: 'belum_bekerja' },
    { id: 'bb4', pertanyaan: 'Kendala utama memperoleh pekerjaan', kategori: 'belum_bekerja' },
    { id: 'bb5', pertanyaan: 'Apa rencana Anda selanjutnya?', kategori: 'belum_bekerja' }
  ]
};

    db.query('SELECT * FROM kuesioner_pertanyaan WHERE is_active = 1 ORDER BY urutan ASC, id ASC', [], (errQ, questions) => {
      let qList = (questions || []).filter(q => q.kategori === statusFilter);
      if (qList.length === 0 && defaultCategoryQuestions[statusFilter]) {
        qList = defaultCategoryQuestions[statusFilter];
      }

      db.query(sql, params, (err, rows) => {
        if (err) console.error('DB error laporan preview (tracer):', err.message);
        let countSql = `SELECT COUNT(*) AS total FROM alumni WHERE is_active = 1`;
        let countParams = [];
        if (statusFilter && statusFilter !== 'semua') {
          countSql = `SELECT COUNT(*) AS total FROM tracer_study WHERE status_pekerjaan = ?`;
          countParams.push(statusFilter);
        }
        db.query(countSql, countParams, (e2, r2) => {
          res.render('admin/laporan-preview', {
            title: 'Pratinjau Hasil Ekspor',
            adminName: req.session.adminName,
            type,
            statusFilter,
            pertanyaanList: qList,
            data: rows || [],
            totalResponden: (r2 && r2[0] && r2[0].total) || 0,
          });
        });
      });
    });
  }
};

function getAnswerValue(r, q) {
  if (!r) return '-';
  let jawabanKustomObj = {};
  if (r.jawaban_kustom) {
    try {
      jawabanKustomObj = typeof r.jawaban_kustom === 'string' ? JSON.parse(r.jawaban_kustom) : r.jawaban_kustom;
    } catch(e) {}
  }
  if (jawabanKustomObj && jawabanKustomObj[q.id] !== undefined && jawabanKustomObj[q.id] !== null && jawabanKustomObj[q.id] !== '') {
    return jawabanKustomObj[q.id];
  }
  const text = (q.pertanyaan || '').toLowerCase();
  if (q.kategori === 'bekerja') {
    if (text.includes('saat ini sudah bekerja')) return r.status_kerja_detail || (r.status_pekerjaan === 'bekerja' ? 'Sudah bekerja' : '-');
    if (text.includes('kapan anda mulai mencari')) return r.kapan_mulai_cari_kerja || '-';
    if (text.includes('berapa lama') || text.includes('waktu yang dibutuhkan')) return r.lama_mencari_kerja || '-';
    if (text.includes('nama instansi') || text.includes('nama perusahaan')) return r.nama_perusahaan || '-';
    if (text.includes('jenis instansi')) return r.jenis_instansi || '-';
    if (text.includes('bidang usaha')) return r.bidang_perusahaan || '-';
    if (text.includes('jabatan')) return r.jabatan || '-';
    if (text.includes('lokasi')) return r.lokasi_perusahaan || '-';
    if (text.includes('status kepegawaian') || text.includes('status pekerjaan')) return r.status_kerja_detail || '-';
    if (text.includes('penghasilan pertama') || text.includes('gaji pertama')) return r.gaji_pertama || '-';
    if (text.includes('penghasilan anda saat ini') || text.includes('gaji saat ini')) return r.penghasilan_bulanan || '-';
    if (text.includes('sesuai dengan bidang studi') || text.includes('kesesuaian bidang')) return r.kesesuaian_bidang || '-';
    if (text.includes('kompetensi yang diperoleh') || text.includes('kesesuaian pekerjaan')) return r.kesesuaian_kompetensi ? r.kesesuaian_kompetensi + ' / 5' : '-';
  }
  if (q.kategori === 'wirausaha') {
    if (text.includes('memiliki usaha sendiri')) return r.status_pekerjaan === 'wirausaha' ? 'Sudah Memiliki Usaha' : '-';
    if (text.includes('nama usaha')) return r.nama_perusahaan || '-';
    if (text.includes('bidang usaha')) return r.bidang_perusahaan || '-';
    if (text.includes('tahun memulai')) return r.kapan_mulai_cari_kerja || '-';
    if (text.includes('jumlah karyawan')) return r.jabatan || '-';
    if (text.includes('omzet')) return r.gaji_pertama || r.penghasilan_bulanan || '-';
    if (text.includes('sumber modal')) return r.media_mencari_kerja || '-';
    if (text.includes('sesuai dengan bidang studi') || text.includes('kesesuaian')) return r.kesesuaian_bidang || '-';
    if (text.includes('perkuliahan membantu')) return r.kesesuaian_kompetensi ? r.kesesuaian_kompetensi + ' / 5' : '-';
  }
  if (q.kategori === 'kuliah') {
    if (text.includes('melanjutkan pendidikan')) return r.status_pekerjaan === 'kuliah' ? 'Ya' : '-';
    if (text.includes('perguruan tinggi') || text.includes('universitas')) return r.nama_universitas || '-';
    if (text.includes('jenjang')) return r.jenjang_lanjut || '-';
    if (text.includes('program studi')) return r.program_studi_lanjut || '-';
    if (text.includes('tahun masuk')) return r.kapan_mulai_cari_kerja || '-';
    if (text.includes('alasan')) return r.saran || '-';
    if (text.includes('sumber pembiayaan')) return r.media_mencari_kerja || '-';
  }
  if (q.kategori === 'belum_bekerja') {
    if (text.includes('mencari pekerjaan')) return r.status_pekerjaan === 'belum_bekerja' ? 'Ya' : '-';
    if (text.includes('melamar pekerjaan')) return r.kapan_mulai_cari_kerja || '-';
    if (text.includes('wawancara kerja')) return r.status_kerja_detail || '-';
    if (text.includes('kendala')) return r.lama_mencari_kerja || '-';
    if (text.includes('rencana anda')) return r.saran || '-';
  }
  return '-';
}

/* helper: buat header Excel dengan style tebal + warna */
function makeXlsxHeader(ws, headers, rowIndex) {
  headers.forEach((h, i) => {
    const cell = xlsx.utils.encode_cell({ r: rowIndex, c: i });
    ws[cell] = {
      v: h, t: 's',
      s: {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '064E3B' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: {
          top: { style: 'thin' }, bottom: { style: 'thin' },
          left: { style: 'thin' }, right: { style: 'thin' }
        }
      }
    };
  });
}

function makeKopSurat(wb, ws, judul, subJudul) {
  xlsx.utils.sheet_add_aoa(ws, [
    ['UNIVERSITAS HAMZANWADI'],
    ['FAKULTAS TEKNIK — PROGRAM STUDI SISTEM INFORMASI'],
    [subJudul],
    ['Jl. TGKH. Muhammad Zainuddin Abdul Madjid No.132, Pancor, Lombok Timur, NTB'],
    [''],
    [judul],
    [''],
  ], { origin: 'A1' });
  ws['!merges'] = ws['!merges'] || [];
  for (let r = 0; r <= 5; r++) {
    ws['!merges'].push({ s: { r, c: 0 }, e: { r, c: 9 } });
  }
}

/* ── GET /admin/laporan/export/tracer ── */
exports.exportTracer = (req, res) => {
  const tahun = new Date().getFullYear();
  const statusFilter = req.query.status || 'semua';
  const joinType = (statusFilter && statusFilter !== 'semua') ? 'INNER JOIN' : 'LEFT JOIN';

  let sql = `SELECT a.nim, a.nama, a.email, a.tahun_lulus, ts.*
             FROM alumni a
             ${joinType} tracer_study ts ON ts.alumni_id = a.id
               AND ts.id = (SELECT t2.id FROM tracer_study t2 WHERE t2.alumni_id = a.id ORDER BY t2.tanggal_isi DESC LIMIT 1)`;
  const params = [];
  if (statusFilter && statusFilter !== 'semua') {
    sql += ` WHERE ts.status_pekerjaan = ?`;
    params.push(statusFilter);
  }
  sql += ` ORDER BY a.tahun_lulus DESC, a.nama ASC`;

  db.query('SELECT * FROM kuesioner_pertanyaan WHERE is_active = 1 ORDER BY urutan ASC, id ASC', [], (errQ, questions) => {
    let qList = (questions || []).filter(q => q.kategori === statusFilter);
    if (qList.length === 0 && defaultCategoryQuestions[statusFilter]) {
      qList = defaultCategoryQuestions[statusFilter];
    }

    db.query(sql, params, (err, rows) => {
      if (err) return res.status(500).send('Export error');

      const wb = xlsx.utils.book_new();
      const ws = {};

      let subJudul = 'Laporan Data Alumni';
      let headers = [];
      let dataRows = [];

      if (statusFilter !== 'semua' && qList.length > 0) {
        let labelKategori = statusFilter;
        if (statusFilter === 'bekerja') labelKategori = 'Bekerja';
        else if (statusFilter === 'wirausaha') labelKategori = 'Wirausaha';
        else if (statusFilter === 'kuliah') labelKategori = 'Studi Lanjut';
        else if (statusFilter === 'belum_bekerja') labelKategori = 'Belum Bekerja';

        subJudul = `Laporan Hasil Tracer Study — Alumni ${labelKategori}`;
        headers = ['No', 'NIM', 'Nama Alumni', 'Thn Lulus', ...qList.map(q => q.pertanyaan)];
        dataRows = (rows || []).map((r, i) => [
          i + 1, r.nim, r.nama, r.tahun_lulus || '-',
          ...qList.map(q => getAnswerValue(r, q))
        ]);
      } else {
        subJudul = 'Laporan Rekapitulasi Semua Alumni';
        headers = ['No','NIM','Nama Alumni','Email','Thn Lulus','Status Karir','Perusahaan / Usaha / Kampus','Jabatan / Jenjang','Gaji / Omzet / Detail','Tgl Isi'];
        dataRows = (rows || []).map((r, i) => {
          let statusLabel = 'Belum Mengisi';
          if (r.status_pekerjaan === 'bekerja') statusLabel = 'Bekerja';
          else if (r.status_pekerjaan === 'wirausaha') statusLabel = 'Wirausaha';
          else if (r.status_pekerjaan === 'kuliah') statusLabel = 'Studi Lanjut';
          else if (r.status_pekerjaan === 'belum_bekerja') statusLabel = 'Belum Bekerja';

          return [
            i + 1, r.nim, r.nama, r.email || '-', r.tahun_lulus || '-',
            statusLabel,
            r.nama_perusahaan || r.nama_universitas || '-',
            r.jabatan || r.jenjang_lanjut || '-',
            r.gaji_pertama || r.penghasilan_bulanan || r.lama_mencari_kerja || '-',
            r.tanggal_isi ? new Date(r.tanggal_isi).toLocaleDateString('id-ID') : '-'
          ];
        });
      }

      const judulLaporan = `LAPORAN HASIL TRACER STUDY — TAHUN ${tahun}`;
      makeKopSurat(wb, ws, judulLaporan, subJudul);
      makeXlsxHeader(ws, headers, 7);
      xlsx.utils.sheet_add_aoa(ws, dataRows, { origin: { r: 8, c: 0 } });

      ws['!cols'] = headers.map(h => ({ wch: Math.max(16, Math.min(50, h.length + 4)) }));
      ws['!ref'] = xlsx.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 8 + dataRows.length, c: headers.length - 1 } });

      xlsx.utils.book_append_sheet(wb, ws, 'Tracer Study');
      const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="Laporan_Tracer_Study_${statusFilter}_${tahun}.xlsx"`);
      res.send(buf);
    });
  });
};

/* ── GET /admin/laporan/export/konseling ── */
exports.exportKonseling = (req, res) => {
  const tahun = new Date().getFullYear();
  db.query(
    `SELECT pk.nama_alumni, pk.nim, pk.tahun_lulus, k.nama AS konselor, pk.topik, pk.status, pk.created_at
     FROM permintaan_konseling pk LEFT JOIN konselor k ON k.id = pk.konselor_id
     ORDER BY pk.created_at DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).send('Export error');

      const wb = xlsx.utils.book_new();
      const ws = {};

      makeKopSurat(wb, ws, `LAPORAN KONSELING KARIR ALUMNI — TAHUN ${tahun}`, 'Laporan Layanan Konseling');

      const headers = ['No','Nama Alumni','NIM','Thn Lulus','Konselor','Topik / Masalah','Status Layanan','Tanggal'];
      makeXlsxHeader(ws, headers, 7);

      const dataRows = (rows || []).map((r, i) => [
        i + 1, r.nama_alumni, r.nim || '-', r.tahun_lulus || '-',
        r.konselor || '-', r.topik,
        r.status === 'sudah_dilayani' ? 'Sudah Dilayani' : 'Belum Dilayani',
        r.created_at ? new Date(r.created_at).toLocaleDateString('id-ID') : '-',
      ]);
      xlsx.utils.sheet_add_aoa(ws, dataRows, { origin: { r: 8, c: 0 } });

      ws['!cols'] = [{ wch: 5 }, { wch: 28 }, { wch: 16 }, { wch: 10 }, { wch: 22 }, { wch: 35 }, { wch: 18 }, { wch: 14 }];
      ws['!ref'] = xlsx.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 8 + dataRows.length, c: 7 } });

      xlsx.utils.book_append_sheet(wb, ws, 'Konseling Karir');
      const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="Laporan_Konseling_Karir_SI_FT_Hamzanwadi_${tahun}.xlsx"`);
      res.send(buf);
    }
  );
};

/* ── GET /admin/laporan/export/lowongan ── */
exports.exportLowongan = (req, res) => {
  const tahun = new Date().getFullYear();
  db.query(
    `SELECT la.nama, la.nim, la.email, la.no_hp, l.judul AS nama_lowongan, l.perusahaan, la.created_at
     FROM lowongan_access la
     JOIN lowongan l ON l.id = la.lowongan_id
     ORDER BY la.created_at DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).send('Export error');

      const wb = xlsx.utils.book_new();
      const ws = {};

      makeKopSurat(wb, ws, `LAPORAN AKSES LOWONGAN KERJA ALUMNI — TAHUN ${tahun}`, 'Laporan Bursa Kerja');

      const headers = ['No','Nama Alumni','NIM','Email','No. HP','Lowongan Dilamar','Perusahaan','Tanggal Akses'];
      makeXlsxHeader(ws, headers, 7);

      const dataRows = (rows || []).map((r, i) => [
        i + 1, r.nama, r.nim || '-', r.email || '-', r.no_hp || '-',
        r.nama_lowongan || '-', r.perusahaan || '-',
        r.created_at ? new Date(r.created_at).toLocaleDateString('id-ID') : '-',
      ]);
      xlsx.utils.sheet_add_aoa(ws, dataRows, { origin: { r: 8, c: 0 } });

      ws['!cols'] = [{ wch: 5 }, { wch: 28 }, { wch: 16 }, { wch: 28 }, { wch: 16 }, { wch: 32 }, { wch: 24 }, { wch: 14 }];
      ws['!ref'] = xlsx.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 8 + dataRows.length, c: 7 } });

      xlsx.utils.book_append_sheet(wb, ws, 'Akses Lowongan');
      const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="Laporan_Akses_Lowongan_SI_FT_Hamzanwadi_${tahun}.xlsx"`);
      res.send(buf);
    }
  );
};

/* ── GET /admin/laporan/export/prodi ── */
exports.exportProdi = (req, res) => {
  const tahun = new Date().getFullYear();
  db.query(
    `SELECT a.nim, a.nama, a.tahun_lulus,
            ts.eval_kurikulum, ts.eval_dosen, ts.eval_fasilitas, ts.kepuasan_layanan, ts.saran, ts.tanggal_isi
     FROM alumni a JOIN tracer_study ts ON ts.alumni_id = a.id
     ORDER BY ts.tanggal_isi DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).send('Export error');

      const wb = xlsx.utils.book_new();
      const ws = {};

      makeKopSurat(wb, ws, `LAPORAN PENILAIAN PROGRAM STUDI — TAHUN ${tahun}`, 'Laporan Evaluasi & Feedback Kurikulum');

      const headers = ['No','NIM','Nama Alumni','Thn Lulus','Eval Kurikulum (1-5)','Eval Dosen (1-5)','Eval Fasilitas (1-5)','Kepuasan Layanan (1-5)','Saran / Masukan','Tgl Isi'];
      makeXlsxHeader(ws, headers, 7);

      const dataRows = (rows || []).map((r, i) => [
        i + 1, r.nim || '-', r.nama, r.tahun_lulus || '-',
        r.eval_kurikulum || '-', r.eval_dosen || '-', r.eval_fasilitas || '-', r.kepuasan_layanan || '-',
        r.saran || '-',
        r.tanggal_isi ? new Date(r.tanggal_isi).toLocaleDateString('id-ID') : '-',
      ]);
      xlsx.utils.sheet_add_aoa(ws, dataRows, { origin: { r: 8, c: 0 } });

      ws['!cols'] = [{ wch: 5 }, { wch: 16 }, { wch: 28 }, { wch: 10 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 20 }, { wch: 40 }, { wch: 14 }];
      ws['!ref'] = xlsx.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 8 + dataRows.length, c: 9 } });

      xlsx.utils.book_append_sheet(wb, ws, 'Penilaian Prodi');
      const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="Laporan_Penilaian_Prodi_SI_FT_Hamzanwadi_${tahun}.xlsx"`);
      res.send(buf);
    }
  );
};
