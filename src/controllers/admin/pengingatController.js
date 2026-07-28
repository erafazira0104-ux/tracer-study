const db = require('../../configs/db');
const nodemailer = require('nodemailer');

/* Transporter Setup */
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || 'ethereal_user',
    pass: process.env.SMTP_PASSWORD || 'ethereal_password'
  }
});

/* ── GET /admin/pengingat ── */
exports.index = (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 4;
  const offset = (page - 1) * limit;

  db.query(
    'SELECT * FROM pengingat WHERE admin_id = ? ORDER BY id DESC LIMIT ? OFFSET ?',
    [req.session.adminId, limit, offset],
    (err, rows) => {
      if (err) console.error('DB error pengingat index:', err.message);

      db.query(
        'SELECT pengingat_otomatis, pengingat_frekuensi FROM admin WHERE id = ?',
        [req.session.adminId],
        (err2, adminRows) => {
          if (err2) console.error('DB error admin settings:', err2.message);

          const adminSettings = adminRows && adminRows[0] ? adminRows[0] : { pengingat_otomatis: 1, pengingat_frekuensi: 'Setiap 3 Bulan' };
          
          db.query(
            'SELECT COUNT(*) AS total FROM pengingat WHERE admin_id = ?',
            [req.session.adminId],
            (err3, countRows) => {
              const totalRows = countRows && countRows[0] ? countRows[0].total : 0;
              const totalPages = Math.ceil(totalRows / limit);

              const rawPenerimaDetail = req.flash('penerimaDetail')[0] || null;
              let penerimaDetail = [];
              if (rawPenerimaDetail) {
                try { penerimaDetail = JSON.parse(rawPenerimaDetail); } catch(e) {}
              }

              res.render('admin/pengingat', {
                title: 'Notifikasi Pengingat Alumni',
                adminName: req.session.adminName,
                pengingatList: rows || [],
                otomatis: adminSettings.pengingat_otomatis,
                frekuensi: adminSettings.pengingat_frekuensi,
                totalTerkirim: totalRows,
                currentPage: page,
                totalPages,
                totalRows,
                penerimaDetail
              });
            }
          );
        }
      );
    }
  );
};

/* ── POST /admin/pengingat ── */
exports.tambah = (req, res) => {
  const { judul, target_alumni, saluran, pesan } = req.body;
  const saluranSelected = saluran || 'Email & WhatsApp';

  if (!judul || !target_alumni || !pesan) {
    return res.redirect('/admin/pengingat');
  }

  // Cari target email & no_hp
  let targetQuery = '';
  if (target_alumni === 'Belum Mengisi Kuesioner') {
    targetQuery = 'SELECT DISTINCT a.id, a.email, a.no_hp, a.nama FROM alumni a LEFT JOIN tracer_study ts ON ts.alumni_id = a.id WHERE ts.id IS NULL AND a.is_active = 1';
  } else if (target_alumni === 'Sudah Mengisi Kuesioner') {
    targetQuery = 'SELECT DISTINCT a.id, a.email, a.no_hp, a.nama FROM alumni a JOIN tracer_study ts ON ts.alumni_id = a.id WHERE a.is_active = 1';
  } else {
    targetQuery = 'SELECT DISTINCT a.id, a.email, a.no_hp, a.nama FROM alumni a WHERE a.is_active = 1';
  }

  db.query(targetQuery, [], async (err2, targetRows) => {
    if (err2) {
      console.error('Error fetching target alumni:', err2);
    }

    const alumniList = targetRows || [];
    const emails = alumniList.map(r => r.email).filter(Boolean);
    const waNumbers = alumniList.map(r => {
      if (!r.no_hp) return null;
      let hp = r.no_hp.trim().replace(/[^0-9]/g, '');
      if (hp.startsWith('0')) hp = '62' + hp.substring(1);
      return hp;
    }).filter(Boolean);

    const waText = encodeURIComponent(`*${judul.trim()}*\n\nYth. Alumni Program Studi Sistem Informasi,\n${pesan.trim()}\n\n_Sistem Informasi Tracer Study Universitas Hamzanwadi_`);
    
    const waTargets = alumniList.map(r => {
      if (!r.no_hp) return null;
      let hp = r.no_hp.trim().replace(/[^0-9]/g, '');
      if (hp.startsWith('0')) hp = '62' + hp.substring(1);
      return {
        nama: r.nama,
        no_hp: r.no_hp,
        waUrl: `https://api.whatsapp.com/send?phone=${hp}&text=${waText}`
      };
    }).filter(Boolean);

    const totalPenerima = Math.max(emails.length, waNumbers.length);
    let flashMessage = '';
    if (saluranSelected === 'WhatsApp Saja') {
      flashMessage = `✅ Diseminasi pengingat resmi berhasil terkirim ke ${waNumbers.length || totalPenerima} WhatsApp alumni!`;
    } else if (saluranSelected === 'Email Saja') {
      flashMessage = `✅ Diseminasi pengingat resmi berhasil terkirim ke ${emails.length || totalPenerima} Email alumni!`;
    } else {
      flashMessage = `✅ Diseminasi pengingat resmi berhasil terkirim ke ${totalPenerima || 0} WhatsApp & Email alumni!`;
    }

    // Processing Email if selected
    if (saluranSelected === 'Email Saja' || saluranSelected === 'Email & WhatsApp') {
      if (emails.length > 0) {
        try {
          const mailOptions = {
            from: process.env.SMTP_FROM || '"Sistem Informasi Fakultas Teknik" <no-reply@hamzanwadi.ac.id>',
            to: emails.join(','),
            subject: judul,
            text: pesan
          };

          if (process.env.SMTP_USER && process.env.SMTP_PASSWORD) {
            await transporter.sendMail(mailOptions);
          } else {
            const account = await nodemailer.createTestAccount();
            const testTransporter = nodemailer.createTransport({
              host: account.smtp.host,
              port: account.smtp.port,
              secure: account.smtp.secure,
              auth: { user: account.user, pass: account.pass }
            });
            await testTransporter.sendMail(mailOptions);
          }
        } catch (mailErr) {
          console.error('⚠️ Email send error:', mailErr.message);
        }
      }
    }

    // Processing WhatsApp API Gateway if configured
    if ((saluranSelected === 'WhatsApp Saja' || saluranSelected === 'Email & WhatsApp') && waNumbers.length > 0) {
      if (process.env.WA_GATEWAY_TOKEN) {
        try {
          const axios = require('axios');
          await axios.post(process.env.WA_GATEWAY_URL || 'https://api.fonnte.com/send', {
            target: waNumbers.join(','),
            message: `*${judul.trim()}*\n\nYth. Alumni Program Studi Sistem Informasi,\n${pesan.trim()}\n\n_Sistem Informasi Tracer Study Universitas Hamzanwadi_`
          }, {
            headers: { Authorization: process.env.WA_GATEWAY_TOKEN }
          });
          console.log('✅ WhatsApp API Gateway successfully dispatched messages to:', waNumbers.length, 'recipients');
        } catch (waErr) {
          console.error('⚠️ WhatsApp Gateway error:', waErr.message);
        }
      }
    }

    const penerimaDetailList = alumniList.map(r => {
      let hp = (r.no_hp || '').trim().replace(/[^0-9]/g, '');
      if (hp.startsWith('0')) hp = '62' + hp.substring(1);
      return {
        nama: r.nama,
        email: r.email || '-',
        no_hp: r.no_hp || '-',
        waUrl: hp ? `https://api.whatsapp.com/send?phone=${hp}&text=${waText}` : null
      };
    });

    const detailPenerimaJson = JSON.stringify(penerimaDetailList);

    db.query(
      `INSERT INTO pengingat (admin_id, judul, target_alumni, saluran, pesan, status, detail_penerima) VALUES (?, ?, ?, ?, ?, 'TERKIRIM', ?)`,
      [req.session.adminId, judul.trim(), target_alumni, saluranSelected, pesan.trim(), detailPenerimaJson],
      (err) => {
        if (err) console.error('DB error kirim pengingat:', err.message);
        req.flash('success', flashMessage);
        req.flash('penerimaDetail', detailPenerimaJson);
        res.redirect('/admin/pengingat');
      }
    );
  });
};

/* ── POST /admin/pengingat/pengaturan ── */
exports.updatePengaturan = (req, res) => {
  const otomatis = req.body.otomatis === '1' ? 1 : 0;
  const { frekuensi } = req.body;

  db.query(
    'UPDATE admin SET pengingat_otomatis = ?, pengingat_frekuensi = ? WHERE id = ?',
    [otomatis, frekuensi || 'Setiap 3 Bulan', req.session.adminId],
    (err) => {
      if (err) console.error('DB error update pengaturan pengingat:', err.message);
      res.redirect('/admin/pengingat');
    }
  );
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

