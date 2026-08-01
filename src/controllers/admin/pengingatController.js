const db = require('../../configs/db');
const nodemailer = require('nodemailer');

/* Transporter Setup */
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASSWORD || ''
  }
});

/* ── GET /admin/pengingat ── */
exports.index = (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 5;
  const offset = (page - 1) * limit;

  // Real DB statistics
  const qBelum = `SELECT COUNT(DISTINCT a.id) AS total FROM alumni a LEFT JOIN tracer_study ts ON ts.alumni_id = a.id WHERE ts.id IS NULL AND a.is_active = 1`;
  const qTanpaHp = `SELECT COUNT(*) AS total FROM alumni WHERE (no_hp IS NULL OR TRIM(no_hp) = '') AND is_active = 1`;
  const qLogs = `SELECT * FROM pengingat WHERE admin_id = ? ORDER BY id DESC LIMIT ? OFFSET ?`;
  const qCountLogs = `SELECT COUNT(*) AS total FROM pengingat WHERE admin_id = ?`;

  db.query(qBelum, [], (err1, rBelum) => {
    const totalBelumMengisi = rBelum && rBelum[0] ? rBelum[0].total : 0;

    db.query(qTanpaHp, [], (err2, rTanpaHp) => {
      const totalTanpaHp = rTanpaHp && rTanpaHp[0] ? rTanpaHp[0].total : 0;

      db.query(qCountLogs, [req.session.adminId], (err3, rCountLogs) => {
        const totalRows = rCountLogs && rCountLogs[0] ? rCountLogs[0].total : 0;
        const totalPages = Math.ceil(totalRows / limit) || 1;

        db.query(qLogs, [req.session.adminId, limit, offset], (err4, logRows) => {
          const pengingatList = logRows || [];

          // Compute real system delivered and failed statistics from logs
          let totalTerkirimBerhasil = 0;
          let totalTerkirimGagal = 0;

          pengingatList.forEach(p => {
            if (p.detail_penerima) {
              try {
                const details = JSON.parse(p.detail_penerima);
                if (Array.isArray(details)) {
                  details.forEach(item => {
                    if (item.status === 'GAGAL') {
                      totalTerkirimGagal++;
                    } else {
                      totalTerkirimBerhasil++;
                    }
                  });
                }
              } catch(e) {}
            }
          });

          const flash_success = req.session.flash_success || null;
          const flash_error = req.session.flash_error || null;
          const rawPenerimaDetail = req.session.penerimaDetail || null;
          delete req.session.flash_success;
          delete req.session.flash_error;
          delete req.session.penerimaDetail;

          let penerimaDetail = [];
          if (rawPenerimaDetail) {
            try { penerimaDetail = JSON.parse(rawPenerimaDetail); } catch(e) {}
          }

          res.render('admin/pengingat', {
            title: 'Pengingat Alumni',
            adminName: req.session.adminName,
            pengingatList,
            totalBelumMengisi,
            totalTanpaHp,
            totalTerkirimBerhasil,
            totalTerkirimGagal,
            currentPage: page,
            totalPages,
            totalRows,
            penerimaDetail,
            flash_success,
            flash_error
          });
        });
      });
    });
  });
};

/* ── POST /admin/pengingat ── */
exports.tambah = (req, res) => {
  const { judul, target_alumni, saluran, pesan } = req.body;
  const saluranSelected = saluran || 'Email & WhatsApp';

  if (!judul || !target_alumni || !pesan) {
    req.session.flash_error = 'Semua field wajib diisi.';
    return res.redirect('/admin/pengingat');
  }

  let targetQuery = '';
  if (target_alumni === 'Belum Mengisi Kuesioner') {
    targetQuery = 'SELECT DISTINCT a.id, a.email, a.no_hp, a.nama FROM alumni a LEFT JOIN tracer_study ts ON ts.alumni_id = a.id WHERE ts.id IS NULL AND a.is_active = 1';
  } else if (target_alumni === 'Sudah Mengisi Kuesioner') {
    targetQuery = 'SELECT DISTINCT a.id, a.email, a.no_hp, a.nama FROM alumni a JOIN tracer_study ts ON ts.alumni_id = a.id WHERE a.is_active = 1';
  } else {
    targetQuery = 'SELECT DISTINCT a.id, a.email, a.no_hp, a.nama FROM alumni a WHERE a.is_active = 1';
  }

  db.query(targetQuery, [], async (err, targetRows) => {
    if (err) {
      console.error('Error fetching target alumni:', err);
      req.session.flash_error = 'Terjadi kesalahan database.';
      return res.redirect('/admin/pengingat');
    }

    const alumniList = targetRows || [];

    if (alumniList.length === 0) {
      req.session.flash_error = 'Tidak ada alumni yang sesuai dengan kriteria target.';
      return res.redirect('/admin/pengingat');
    }

    const waText = encodeURIComponent(`*${judul.trim()}*\n\nYth. Alumni Program Studi Sistem Informasi,\n${pesan.trim()}\n\n_Sistem Informasi Tracer Study Universitas Hamzanwadi_`);

    // 1. Instant Email dispatch check (No slow external ethereal network calls if unconfigured)
    let emailStatusObj = { attempted: false, success: false, error: null };
    const emails = alumniList.map(r => r.email).filter(e => e && e.includes('@'));

    if (saluranSelected === 'Email Saja' || saluranSelected === 'Email & WhatsApp') {
      emailStatusObj.attempted = true;
      if (emails.length === 0) {
        emailStatusObj.success = false;
        emailStatusObj.error = 'Tidak ada email alumni yang terdaftar / valid';
      } else if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
        // Fast instant feedback if SMTP unconfigured
        emailStatusObj.success = false;
        emailStatusObj.error = 'Kredensial SMTP Email belum dikonfigurasi di file .env';
      } else {
        try {
          const mailOptions = {
            from: process.env.SMTP_FROM || '"Sistem Informasi Fakultas Teknik" <no-reply@hamzanwadi.ac.id>',
            to: emails.join(','),
            subject: judul,
            text: pesan
          };
          await transporter.sendMail(mailOptions);
          emailStatusObj.success = true;
        } catch (mailErr) {
          console.error('⚠️ Email send error:', mailErr.message);
          emailStatusObj.success = false;
          emailStatusObj.error = `SMTP Email Error: ${mailErr.message}`;
        }
      }
    }

    // 2. Instant WhatsApp API Gateway (Fonnte) dispatch check with 2.5s fast timeout
    let waStatusObj = { attempted: false, success: false, error: null };
    const waNumbers = alumniList.map(r => {
      if (!r.no_hp) return null;
      let hp = r.no_hp.trim().replace(/[^0-9]/g, '');
      if (hp.startsWith('0')) hp = '62' + hp.substring(1);
      return hp.length >= 10 ? hp : null;
    }).filter(Boolean);

    if (saluranSelected === 'WhatsApp Saja' || saluranSelected === 'Email & WhatsApp') {
      waStatusObj.attempted = true;
      const waGatewayUrl = process.env.WA_GATEWAY_URL || 'https://api.fonnte.com/send';
      const waGatewayToken = process.env.WA_GATEWAY_TOKEN;

      if (waNumbers.length === 0) {
        waStatusObj.success = false;
        waStatusObj.error = 'Tidak ada nomor WhatsApp alumni yang terdaftar / valid';
      } else if (!waGatewayToken || waGatewayToken.trim() === '') {
        // Fast instant feedback if WA token unconfigured
        waStatusObj.success = false;
        waStatusObj.error = 'Token WA Gateway (Fonnte) belum dikonfigurasi di file .env';
      } else {
        try {
          const axios = require('axios');
          const response = await axios.post(waGatewayUrl, {
            target: waNumbers.join(','),
            message: `*${judul.trim()}*\n\nYth. Alumni Program Studi Sistem Informasi,\n${pesan.trim()}\n\n_Sistem Informasi Tracer Study Universitas Hamzanwadi_`
          }, {
            headers: { Authorization: waGatewayToken },
            timeout: 2500 // Fast 2.5 seconds timeout instead of lagging 10s
          });

          // Verify Fonnte API response JSON
          if (response.data && (response.data.status === true || response.data.status === 'true')) {
            waStatusObj.success = true;
          } else {
            const fonnteReason = response.data?.reason || response.data?.message || 'Token Fonnte tidak valid / kuota habis';
            waStatusObj.success = false;
            waStatusObj.error = `WA Gateway Error: ${fonnteReason}`;
          }
        } catch (waErr) {
          const errDetail = waErr.response?.data?.reason || waErr.response?.data?.message || waErr.message || 'Koneksi Fonnte Timeout / Server Error';
          console.error('⚠️ WhatsApp Gateway error:', errDetail);
          waStatusObj.success = false;
          waStatusObj.error = `Gagal WA Gateway: ${errDetail}`;
        }
      }
    }

    // 3. Evaluate recipient results with exact technical failure reasons
    const penerimaDetailList = [];
    let berhasilCount = 0;
    let gagalCount = 0;

    alumniList.forEach(r => {
      let hp = (r.no_hp || '').trim().replace(/[^0-9]/g, '');
      if (hp.startsWith('0')) hp = '62' + hp.substring(1);

      const hasValidHp = hp.length >= 10;
      const hasEmail = r.email && r.email.includes('@');

      let isSuccess = true;
      const failureReasons = [];

      // Check contact availability
      if ((saluranSelected === 'WhatsApp Saja' || saluranSelected === 'Email & WhatsApp') && !hasValidHp) {
        failureReasons.push('No. HP Kosong / Format Tidak Valid');
      }
      if ((saluranSelected === 'Email Saja' || saluranSelected === 'Email & WhatsApp') && !hasEmail) {
        failureReasons.push('Email Kosong / Format Tidak Valid');
      }

      // Check gateway errors
      if (emailStatusObj.attempted && !emailStatusObj.success) {
        isSuccess = false;
        failureReasons.push(emailStatusObj.error);
      }

      if (waStatusObj.attempted && !waStatusObj.success) {
        isSuccess = false;
        failureReasons.push(waStatusObj.error);
      }

      if (isSuccess && failureReasons.length === 0) {
        berhasilCount++;
        penerimaDetailList.push({
          nama: r.nama,
          email: r.email || '-',
          no_hp: r.no_hp || '-',
          status: 'BERHASIL',
          alasan: 'Pesan Berhasil Terkirim via Fonnte Gateway',
          waUrl: hp ? `https://api.whatsapp.com/send?phone=${hp}&text=${waText}` : null
        });
      } else {
        gagalCount++;
        penerimaDetailList.push({
          nama: r.nama,
          email: r.email || '-',
          no_hp: r.no_hp || '-',
          status: 'GAGAL',
          alasan: failureReasons.join('; '),
          waUrl: hp ? `https://api.whatsapp.com/send?phone=${hp}&text=${waText}` : null
        });
      }
    });

    const overallStatus = gagalCount === 0 ? 'TERKIRIM' : (berhasilCount === 0 ? 'GAGAL' : 'PARSIAL');
    const detailPenerimaJson = JSON.stringify(penerimaDetailList);

    if (overallStatus === 'GAGAL') {
      const primaryError = penerimaDetailList[0]?.alasan || 'Token WA Gateway Fonnte / SMTP belum dikonfigurasi di file .env.';
      req.session.flash_error = `❌ <strong>Diseminasi Gagal:</strong> ${primaryError} <br/><small style="display:inline-block; margin-top:4px;">💡 <em>Petunjuk: Gunakan tombol '👁️ Lihat Daftar Penerima' atau tombol 'Chat WA' pada rincian penerima di bawah untuk mengirim pesan secara manual via WhatsApp.</em></small>`;
    } else if (overallStatus === 'PARSIAL') {
      req.session.flash_success = `⚠️ <strong>Diseminasi Parsial:</strong> ${berhasilCount} alumni berhasil, <strong>${gagalCount} alumni gagal terkirim</strong>. Rincian kesalahan dapat dilihat pada tombol '👁️ Lihat Daftar Penerima'.`;
    } else {
      req.session.flash_success = `✅ <strong>Diseminasi Berhasil:</strong> Pesan pengingat resmi berhasil terkirim via Fonnte Gateway ke <strong>${berhasilCount} alumni</strong>!`;
    }

    db.query(
      `INSERT INTO pengingat (admin_id, judul, target_alumni, saluran, pesan, status, detail_penerima) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.session.adminId, judul.trim(), target_alumni, saluranSelected, pesan.trim(), overallStatus, detailPenerimaJson],
      (errInsert) => {
        if (errInsert) console.error('DB error kirim pengingat:', errInsert.message);
        req.session.penerimaDetail = detailPenerimaJson;
        res.redirect('/admin/pengingat');
      }
    );
  });
};

/* ── POST /admin/pengingat/:id/hapus ── */
exports.hapus = (req, res) => {
  db.query(
    `DELETE FROM pengingat WHERE id = ? AND admin_id = ?`,
    [req.params.id, req.session.adminId],
    (err) => {
      if (err) console.error('DB error hapus pengingat:', err.message);
      res.redirect('/admin/pengingat');
    }
  );
};
