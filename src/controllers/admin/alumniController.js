/**
 * Admin — Manajemen Alumni Controller
 */
const bcrypt = require('bcrypt');
const db     = require('../../configs/db');
const xlsx   = require('xlsx');
const pdfParse = require('pdf-parse');

/* ── GET /admin/alumni ── */
exports.index = (req, res) => {
  const search = req.query.search ? `%${req.query.search}%` : '%';
  const page   = parseInt(req.query.page) || 1;
  const limit  = 10;
  const offset = (page - 1) * limit;
  const status = req.query.status || '';

  let sqlBase = `
     FROM alumni a
     LEFT JOIN (
       SELECT alumni_id, MAX(id) AS max_id FROM tracer_study GROUP BY alumni_id
     ) ts_sub ON ts_sub.alumni_id = a.id
     LEFT JOIN tracer_study ts ON ts.id = ts_sub.max_id
     WHERE (a.nama LIKE ? OR a.nim LIKE ? OR a.email LIKE ?)
  `;
  const params = [search, search, search];

  if (status === 'sudah') {
    sqlBase += ' AND ts.id IS NOT NULL';
  } else if (status === 'belum') {
    sqlBase += ' AND ts.id IS NULL';
  }

  const querySql = `SELECT a.id, a.nim, a.nama, a.email, a.no_hp, a.tahun_lulus, a.angkatan, a.is_active,
                           IF(ts.id IS NOT NULL, 1, 0) AS sudah_tracer
                    ${sqlBase}
                    ORDER BY a.created_at DESC
                    LIMIT ? OFFSET ?`;

  db.query(querySql, [...params, limit, offset], (err, rows) => {
    if (err) {
      console.error('DB error fetching alumni:', err);
      return res.status(500).send('DB error');
    }

    // Hitung total untuk pagination
    const countSql = `SELECT COUNT(*) AS total ${sqlBase}`;
    db.query(countSql, params, (err2, countRows) => {
      if (err2) {
        console.error('DB error counting alumni:', err2);
        return res.status(500).send('DB error');
      }
      const totalRows  = countRows && countRows[0] ? countRows[0].total : 0;
      const totalPages = Math.ceil(totalRows / limit);

      // Summary cards data
      db.query(
        `SELECT
           COUNT(DISTINCT a.id) AS totalAlumni,
           COUNT(DISTINCT ts.alumni_id) AS sudahMengisi
         FROM alumni a LEFT JOIN tracer_study ts ON ts.alumni_id = a.id
         WHERE a.is_active = 1`,
        (e3, sumRows) => {
          const sumData = sumRows && sumRows[0] ? sumRows[0] : { totalAlumni: 0, sudahMengisi: 0 };
          const belumMengisi = sumData.totalAlumni - sumData.sudahMengisi;
          const partisipasi  = sumData.totalAlumni > 0
            ? Math.round((sumData.sudahMengisi / sumData.totalAlumni) * 100)
            : 0;

          res.render('admin/alumni', {
            title       : 'Data Alumni',
            adminName   : req.session.adminName,
            alumni      : rows,
            search      : req.query.search || '',
            filterStatus: status,
            currentPage : page,
            totalPages,
            totalRows,
            sumData     : { ...sumData, belumMengisi, partisipasi },
            flash_success: req.session.flash_success || null,
            flash_error  : req.session.flash_error   || null,
          });
          delete req.session.flash_success;
          delete req.session.flash_error;
        }
      );
    });
  });
};

/* ── GET /admin/alumni/tambah ── */
exports.showTambah = (req, res) => {
  res.render('admin/alumni-form', {
    title    : 'Tambah Alumni',
    adminName: req.session.adminName,
    alumni   : null,
    error    : null,
  });
};

/* ── POST /admin/alumni/tambah ── */
exports.store = async (req, res) => {
  const { nim, nama, email, password, no_hp, tahun_masuk, tahun_lulus, angkatan, jenis_kelamin, fakultas, program_studi, tempat_lahir, tanggal_lahir, alamat, ipk_terakhir } = req.body;
  const plainPw = password && password.trim() ? password.trim() : 'alumni123';
  try {
    const hash = await bcrypt.hash(plainPw, 10);
    db.query(
      `INSERT INTO alumni (nim, nama, email, password, password_plain, no_hp, tahun_masuk, tahun_lulus, angkatan, jenis_kelamin, fakultas, program_studi, tempat_lahir, tanggal_lahir, alamat, ipk_terakhir, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        nim, nama, email, hash, plainPw, no_hp, tahun_masuk || null, tahun_lulus || null, angkatan, jenis_kelamin || null,
        fakultas || 'Fakultas Teknik', program_studi || 'Sistem Informasi', tempat_lahir || null, tanggal_lahir || null, alamat || null, ipk_terakhir || null
      ],
      (err) => {
        if (err) {
          console.error('Error inserting alumni:', err);
          return res.render('admin/alumni-form', {
            title: 'Tambah Alumni', adminName: req.session.adminName,
            alumni: req.body, error: err.code === 'ER_DUP_ENTRY' ? 'NIM atau Email sudah terdaftar.' : 'Gagal menyimpan data.',
          });
        }
        req.session.flash_success = 'Alumni berhasil ditambahkan.';
        res.redirect('/admin/alumni');
      }
    );
  } catch (e) {
    res.status(500).send('Server error');
  }
};

/* ── GET /admin/alumni/:id/edit ── */
exports.showEdit = (req, res) => {
  db.query('SELECT * FROM alumni WHERE id = ?', [req.params.id], (err, rows) => {
    if (err || rows.length === 0) return res.redirect('/admin/alumni');
    res.render('admin/alumni-form', {
      title    : 'Edit Alumni',
      adminName: req.session.adminName,
      alumni   : rows[0],
      error    : null,
    });
  });
};

/* ── POST /admin/alumni/:id/edit ── */
exports.update = async (req, res) => {
  const { nim, nama, email, no_hp, tahun_masuk, tahun_lulus, angkatan, jenis_kelamin, password, fakultas, program_studi, tempat_lahir, tanggal_lahir, alamat, ipk_terakhir } = req.body;
  const id = req.params.id;

  let sql, params;
  if (password && password.trim()) {
    const plainPw = password.trim();
    const hash = await bcrypt.hash(plainPw, 10);
    sql    = 'UPDATE alumni SET nim=?, nama=?, email=?, password=?, password_plain=?, no_hp=?, tahun_masuk=?, tahun_lulus=?, angkatan=?, jenis_kelamin=?, fakultas=?, program_studi=?, tempat_lahir=?, tanggal_lahir=?, alamat=?, ipk_terakhir=? WHERE id=?';
    params = [
      nim, nama, email, hash, plainPw, no_hp, tahun_masuk||null, tahun_lulus||null, angkatan, jenis_kelamin||null,
      fakultas||'Fakultas Teknik', program_studi||'Sistem Informasi', tempat_lahir||null, tanggal_lahir||null, alamat||null, ipk_terakhir||null, id
    ];
  } else {
    sql    = 'UPDATE alumni SET nim=?, nama=?, email=?, no_hp=?, tahun_masuk=?, tahun_lulus=?, angkatan=?, jenis_kelamin=?, fakultas=?, program_studi=?, tempat_lahir=?, tanggal_lahir=?, alamat=?, ipk_terakhir=? WHERE id=?';
    params = [
      nim, nama, email, no_hp, tahun_masuk||null, tahun_lulus||null, angkatan, jenis_kelamin||null,
      fakultas||'Fakultas Teknik', program_studi||'Sistem Informasi', tempat_lahir||null, tanggal_lahir||null, alamat||null, ipk_terakhir||null, id
    ];
  }

  db.query(sql, params, (err) => {
    if (err) {
      console.error('Error updating alumni:', err);
      return db.query('SELECT * FROM alumni WHERE id = ?', [id], (e2, rows) => {
        res.render('admin/alumni-form', {
          title: 'Edit Alumni', adminName: req.session.adminName,
          alumni: rows[0] || req.body, error: 'Gagal menyimpan. NIM/Email mungkin sudah dipakai.',
        });
      });
    }
    req.session.flash_success = 'Data alumni berhasil diperbarui.';
    res.redirect('/admin/alumni');
  });
};

/* ── POST /admin/alumni/:id/hapus ── */
exports.destroy = (req, res) => {
  db.query('DELETE FROM alumni WHERE id = ?', [req.params.id], (err) => {
    req.session.flash_success = err ? null : 'Alumni berhasil dihapus.';
    req.session.flash_error   = err ? 'Gagal menghapus alumni.' : null;
    res.redirect('/admin/alumni');
  });
};

/* ── POST /admin/alumni/:id/toggle ── */
exports.toggleStatus = (req, res) => {
  db.query('UPDATE alumni SET is_active = NOT is_active WHERE id = ?', [req.params.id], () => {
    res.redirect('/admin/alumni');
  });
};

/* ── POST /admin/alumni/:id/reset-password ── */
exports.resetPassword = async (req, res) => {
  const id = req.params.id;
  try {
    const hash = await bcrypt.hash('alumni123', 10);
    db.query('UPDATE alumni SET password = ? WHERE id = ?', [hash, id], (err) => {
      if (err) {
        console.error('Error resetting password:', err);
        req.session.flash_error = 'Gagal mereset password.';
      } else {
        req.session.flash_success = 'Password alumni berhasil di-reset ke default: alumni123';
      }
      res.redirect('/admin/alumni');
    });
  } catch (e) {
    console.error('Reset password exception:', e);
    req.session.flash_error = 'Terjadi kesalahan server.';
    res.redirect('/admin/alumni');
  }
};

/* ── GET /admin/alumni/export ── */
exports.exportCsv = (req, res) => {
  db.query(
    `SELECT nim, nama, email, no_hp, jenis_kelamin, tahun_masuk, tahun_lulus, angkatan, is_active
     FROM alumni ORDER BY created_at DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).send('Export error');
      const headers = ['NIM','Nama Alumni','Email','No HP','Jenis Kelamin','Tahun Masuk','Tahun Lulus','Angkatan','Status'];
      const body = (rows || []).map(r => [
        r.nim, r.nama, r.email, r.no_hp || '', r.jenis_kelamin || '',
        r.tahun_masuk || '', r.tahun_lulus || '', r.angkatan || '',
        r.is_active ? 'Aktif' : 'Nonaktif'
      ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(','));
      const csv = [headers.join(','), ...body].join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="Data_Alumni.csv"');
      res.send('\uFEFF' + csv);
    }
  );
};

/* ── POST /admin/alumni/import ── */
exports.importCsv = async (req, res) => {
  if (!req.file) {
    req.session.flash_error = 'Silakan pilih file data terlebih dahulu.';
    return res.redirect('/admin/alumni');
  }

  const fileBuffer = req.file.buffer;
  const fileName = req.file.originalname.toLowerCase();

  try {
    let parsedAlumniList = [];

    if (fileName.endsWith('.pdf')) {
      // PDF text parsing
      const pdfData = await pdfParse(fileBuffer);
      const text = pdfData.text || '';
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
      const nimRegex = /\b\d{8,12}\b/;
      const phoneRegex = /\b(?:08|\+62|62)\d{8,11}\b/;

      for (const line of lines) {
        const emailMatch = line.match(emailRegex);
        const nimMatch = line.match(nimRegex);
        
        if (emailMatch && nimMatch) {
          const email = emailMatch[0];
          const nim = nimMatch[0];
          
          const phoneMatch = line.match(phoneRegex);
          const no_hp = phoneMatch ? phoneMatch[0] : null;

          let nameCandidate = line
            .replace(email, '')
            .replace(nim, '')
            .replace(no_hp || '', '')
            .replace(/[,;|]/g, ' ')
            .trim();

          // Guess gender
          let jk = 'L';
          const genderMatch = nameCandidate.match(/\b(L|P|Laki-laki|Perempuan|Laki|Wanita)\b/i);
          if (genderMatch) {
            const g = genderMatch[0].toUpperCase();
            if (g.startsWith('P') || g.startsWith('W')) jk = 'P';
            nameCandidate = nameCandidate.replace(genderMatch[0], '').trim();
          }

          // Guess years (masuk/lulus)
          const years = nameCandidate.match(/\b(19|20)\d{2}\b/g) || [];
          let tahun_masuk = null;
          let tahun_lulus = null;

          if (years.length >= 2) {
            tahun_masuk = parseInt(years[0]);
            tahun_lulus = parseInt(years[1]);
            nameCandidate = nameCandidate.replace(years[0], '').replace(years[1], '').trim();
          } else if (years.length === 1) {
            tahun_lulus = parseInt(years[0]);
            nameCandidate = nameCandidate.replace(years[0], '').trim();
          }

          let nama = nameCandidate
            .replace(/[^a-zA-Z\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim();

          if (!nama || nama.length < 3) {
            nama = 'Alumni SI';
          }

          parsedAlumniList.push({
            nim,
            nama,
            email,
            no_hp,
            jenis_kelamin: jk,
            tahun_masuk,
            tahun_lulus,
            angkatan: tahun_masuk ? String(tahun_masuk) : null
          });
        }
      }
    } else if (fileName.endsWith('.csv')) {
      // Robust CSV parsing
      let csvData = fileBuffer.toString('utf8');
      if (csvData.startsWith('\ufeff')) {
        csvData = csvData.slice(1);
      }
      const lines = csvData.split(/\r?\n/).filter(line => line.trim().length > 0);
      
      if (lines.length > 1) {
        // Find header row dynamically
        let headerRowIdx = 0;
        let headers = [];
        let foundHeader = false;

        for (let r = 0; r < Math.min(lines.length, 10); r++) {
          const rawLine = lines[r];
          // Try both delimiters
          const commaCount = (rawLine.match(/,/g) || []).length;
          const semicolonCount = (rawLine.match(/;/g) || []).length;
          const delimiter = semicolonCount > commaCount ? ';' : ',';

          const candidateParts = rawLine.split(delimiter).map(p => {
            let val = p.trim();
            if (val.startsWith('"') && val.endsWith('"')) {
              val = val.slice(1, -1).trim();
            }
            return val.toLowerCase();
          });

          const hasNim = candidateParts.some(h => h.includes('nim') || h.includes('no.induk') || h.includes('student id'));
          const hasNama = candidateParts.some(h => h.includes('nama') && !h.includes('perusahaan') && !h.includes('universitas'));
          const hasEmail = candidateParts.some(h => h.includes('email') || h.includes('surel'));

          if (hasNim || hasNama || hasEmail) {
            headerRowIdx = r;
            headers = candidateParts;
            foundHeader = true;
            break;
          }
        }

        const delimiter = (lines[headerRowIdx].match(/;/g) || []).length > (lines[headerRowIdx].match(/,/g) || []).length ? ';' : ',';

        if (!foundHeader) {
          headers = lines[0].split(delimiter).map(p => {
            let val = p.trim();
            if (val.startsWith('"') && val.endsWith('"')) {
              val = val.slice(1, -1).trim();
            }
            return val.toLowerCase();
          });
        }

        let nimIdx = -1, namaIdx = -1, emailIdx = -1, hpIdx = -1, jkIdx = -1, masukIdx = -1, lulusIdx = -1, angkatanIdx = -1;
        for (let i = 0; i < headers.length; i++) {
          const h = headers[i];
          if (h.includes('nim') || h.includes('no.induk') || h.includes('student id')) {
            nimIdx = i;
          } else if (h.includes('nama') && !h.includes('perusahaan') && !h.includes('universitas') && !h.includes('kampus')) {
            namaIdx = i;
          } else if (h.includes('email') || h.includes('surel')) {
            emailIdx = i;
          } else if (h.includes('hp') || h.includes('telp') || h.includes('telepon') || h.includes('phone') || h.includes('kontak') || h.includes('whatsapp')) {
            hpIdx = i;
          } else if (h.includes('kelamin') || h.includes('gender') || h.includes('jk') || h.includes('sex') || h.includes('jenis')) {
            jkIdx = i;
          } else if (h.includes('masuk') || h.includes('thnmasuk') || h.includes('tahunmasuk')) {
            masukIdx = i;
          } else if (h.includes('lulus') || h.includes('thnlulus') || h.includes('tahunlulus') || h.includes('alumni')) {
            lulusIdx = i;
          } else if (h.includes('angkatan')) {
            angkatanIdx = i;
          }
        }

        // Fallbacks
        if (nimIdx === -1) nimIdx = 0;
        if (namaIdx === -1) namaIdx = 1;
        if (emailIdx === -1) emailIdx = 2;
        if (hpIdx === -1 && headers.length > 3) hpIdx = 3;
        if (jkIdx === -1 && headers.length > 4) jkIdx = 4;
        if (masukIdx === -1 && headers.length > 5) masukIdx = 5;
        if (lulusIdx === -1 && headers.length > 6) lulusIdx = 6;
        if (angkatanIdx === -1 && headers.length > 7) angkatanIdx = 7;

        const dataLines = lines.slice(headerRowIdx + 1);
        for (const line of dataLines) {
          const parts = [];
          let insideQuote = false;
          let entry = '';
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              insideQuote = !insideQuote;
            } else if (char === delimiter && !insideQuote) {
              parts.push(entry.trim());
              entry = '';
            } else {
              entry += char;
            }
          }
          parts.push(entry.trim());

          const cleanParts = parts.map(p => {
            let val = p.trim();
            if (val.startsWith('"') && val.endsWith('"')) {
              val = val.slice(1, -1).trim();
            }
            return val;
          });

          if (cleanParts.length < 3) continue;

          let rawNim = String(cleanParts[nimIdx] || '').trim();
          if (rawNim.endsWith('.0')) {
            rawNim = rawNim.slice(0, -2);
          }
          const rawNama = String(cleanParts[namaIdx] || '').trim();
          const rawEmail = String(cleanParts[emailIdx] || '').trim();

          if (!rawNim || !rawNama || !rawEmail) continue;

          const no_hp = hpIdx !== -1 && cleanParts[hpIdx] ? String(cleanParts[hpIdx]).trim() : null;
          
          let jk = 'L';
          if (jkIdx !== -1 && cleanParts[jkIdx]) {
            const rawJk = String(cleanParts[jkIdx]).toUpperCase().trim();
            if (rawJk.startsWith('P') || rawJk.startsWith('W') || rawJk.includes('PEREMPUAN') || rawJk.includes('WANITA')) {
              jk = 'P';
            }
          }
          const rawMasuk = masukIdx !== -1 && cleanParts[masukIdx] ? parseInt(cleanParts[masukIdx]) : null;
          const tahun_masuk = (rawMasuk === null || isNaN(rawMasuk)) ? null : rawMasuk;
          const rawLulus = lulusIdx !== -1 && cleanParts[lulusIdx] ? parseInt(cleanParts[lulusIdx]) : null;
          const tahun_lulus = (rawLulus === null || isNaN(rawLulus)) ? null : rawLulus;
          const angkatan = angkatanIdx !== -1 && cleanParts[angkatanIdx] ? String(cleanParts[angkatanIdx]).trim() : (tahun_masuk ? String(tahun_masuk) : null);

          parsedAlumniList.push({
            nim: rawNim,
            nama: rawNama,
            email: rawEmail,
            no_hp,
            jenis_kelamin: jk,
            tahun_masuk,
            tahun_lulus,
            angkatan
          });
        }
      }
    } else {
      // Excel/Spreadsheet (.xlsx, .xls) parsing via SheetJS
      const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

      if (rows.length <= 1) {
        req.session.flash_error = 'File data kosong atau tidak memiliki data.';
        return res.redirect('/admin/alumni');
      }

      // Map column indexes dynamically based on header text
      let headerRowIdx = 0;
      let headers = [];
      let foundHeader = false;

      for (let r = 0; r < Math.min(rows.length, 10); r++) {
        const candidateHeaders = (rows[r] || []).map(h => String(h || '').toLowerCase().trim());
        const hasNim = candidateHeaders.some(h => h.includes('nim') || h.includes('no.induk') || h.includes('student id'));
        const hasNama = candidateHeaders.some(h => h.includes('nama') && !h.includes('perusahaan') && !h.includes('universitas'));
        const hasEmail = candidateHeaders.some(h => h.includes('email') || h.includes('surel'));

        if (hasNim || hasNama || hasEmail) {
          headerRowIdx = r;
          headers = candidateHeaders;
          foundHeader = true;
          break;
        }
      }

      if (!foundHeader) {
        headers = rows[0].map(h => String(h || '').toLowerCase().trim());
      }
      
      let nimIdx = -1, namaIdx = -1, emailIdx = -1, hpIdx = -1, jkIdx = -1, masukIdx = -1, lulusIdx = -1, angkatanIdx = -1;

      for (let i = 0; i < headers.length; i++) {
        const h = headers[i];
        if (h.includes('nim') || h.includes('no.induk') || h.includes('student id')) {
          nimIdx = i;
        } else if (h.includes('nama') && !h.includes('perusahaan') && !h.includes('universitas') && !h.includes('kampus')) {
          namaIdx = i;
        } else if (h.includes('email') || h.includes('surel')) {
          emailIdx = i;
        } else if (h.includes('hp') || h.includes('telp') || h.includes('telepon') || h.includes('phone') || h.includes('kontak') || h.includes('whatsapp')) {
          hpIdx = i;
        } else if (h.includes('kelamin') || h.includes('gender') || h.includes('jk') || h.includes('sex') || h.includes('jenis')) {
          jkIdx = i;
        } else if (h.includes('masuk') || h.includes('thnmasuk') || h.includes('tahunmasuk')) {
          masukIdx = i;
        } else if (h.includes('lulus') || h.includes('thnlulus') || h.includes('tahunlulus') || h.includes('alumni')) {
          lulusIdx = i;
        } else if (h.includes('angkatan')) {
          angkatanIdx = i;
        }
      }

      // Fallbacks if columns are not named
      if (nimIdx === -1) nimIdx = 0;
      if (namaIdx === -1) namaIdx = 1;
      if (emailIdx === -1) emailIdx = 2;
      if (hpIdx === -1 && headers.length > 3) hpIdx = 3;
      if (jkIdx === -1 && headers.length > 4) jkIdx = 4;
      if (masukIdx === -1 && headers.length > 5) masukIdx = 5;
      if (lulusIdx === -1 && headers.length > 6) lulusIdx = 6;
      if (angkatanIdx === -1 && headers.length > 7) angkatanIdx = 7;

      const dataRows = rows.slice(headerRowIdx + 1);
      for (const row of dataRows) {
        if (!row || row.length === 0) continue;

        let rawNim = '';
        if (row[nimIdx] !== undefined && row[nimIdx] !== null) {
          rawNim = String(row[nimIdx]).trim();
          if (rawNim.endsWith('.0')) {
            rawNim = rawNim.slice(0, -2);
          }
        }
        const rawNama = String(row[namaIdx] || '').trim();
        const rawEmail = String(row[emailIdx] || '').trim();

        if (!rawNim || !rawNama || !rawEmail) {
          continue;
        }

        const no_hp = hpIdx !== -1 && row[hpIdx] ? String(row[hpIdx]).trim() : null;
        
        let jk = 'L';
        if (jkIdx !== -1 && row[jkIdx]) {
          const rawJk = String(row[jkIdx]).toUpperCase().trim();
          if (rawJk.startsWith('P') || rawJk.startsWith('W') || rawJk.includes('PEREMPUAN') || rawJk.includes('WANITA')) {
            jk = 'P';
          }
        }

        const rawMasuk = masukIdx !== -1 && row[masukIdx] ? parseInt(row[masukIdx]) : null;
        const tahun_masuk = (rawMasuk === null || isNaN(rawMasuk)) ? null : rawMasuk;
        const rawLulus = lulusIdx !== -1 && row[lulusIdx] ? parseInt(row[lulusIdx]) : null;
        const tahun_lulus = (rawLulus === null || isNaN(rawLulus)) ? null : rawLulus;
        const angkatan = angkatanIdx !== -1 && row[angkatanIdx] ? String(row[angkatanIdx]).trim() : (tahun_masuk ? String(tahun_masuk) : null);

        parsedAlumniList.push({
          nim: rawNim,
          nama: rawNama,
          email: rawEmail,
          no_hp,
          jenis_kelamin: jk,
          tahun_masuk,
          tahun_lulus,
          angkatan
        });
      }
    }

    if (parsedAlumniList.length === 0) {
      req.session.flash_error = 'Tidak ada data valid yang dapat diimpor. Pastikan file berisi NIM, Nama, dan Email.';
      return res.redirect('/admin/alumni');
    }

    const defaultHash = await bcrypt.hash('alumni123', 10);
    let successCount = 0;
    let failCount = 0;

    for (const item of parsedAlumniList) {
      try {
        await new Promise((resolve, reject) => {
          db.query('SELECT id FROM alumni WHERE nim = ?', [item.nim], (e, checkRows) => {
            if (e) return reject(e);
            if (checkRows.length > 0) {
              const existingId = checkRows[0].id;
              db.query(
                `UPDATE alumni SET nama=?, email=?, no_hp=?, jenis_kelamin=?, tahun_masuk=?, tahun_lulus=?, angkatan=?
                 WHERE id=?`,
                [item.nama, item.email, item.no_hp, item.jenis_kelamin, item.tahun_masuk, item.tahun_lulus, item.angkatan, existingId],
                (e2) => {
                  if (e2) reject(e2);
                  else resolve();
                }
              );
            } else {
              db.query(
                `INSERT INTO alumni (nim, nama, email, password, no_hp, jenis_kelamin, tahun_masuk, tahun_lulus, angkatan)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [item.nim, item.nama, item.email, defaultHash, item.no_hp, item.jenis_kelamin, item.tahun_masuk, item.tahun_lulus, item.angkatan],
                (e2) => {
                  if (e2) reject(e2);
                  else resolve();
                }
              );
            }
          });
        });
        successCount++;
      } catch (err) {
        console.error('Import database insert error:', item, err.message);
        failCount++;
      }
    }

    req.session.flash_success = `Berhasil mengimpor ${successCount} data alumni. ${failCount > 0 ? `Gagal: ${failCount} baris.` : ''}`;
  } catch (error) {
    console.error('Import processing error:', error);
    req.session.flash_error = 'Terjadi kesalahan saat memproses file import.';
  }

  res.redirect('/admin/alumni');
};

