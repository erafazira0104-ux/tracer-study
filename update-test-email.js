require('dotenv').config();
const mysql = require('mysql2/promise');

async function run() {
  const host = process.env.DB_HOST || 'localhost';
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'tracer_study';

  console.log(`Connecting to database ${database}...`);
  const connection = await mysql.createConnection({ host, user, password, database });

  const testEmail = 'erafazira0104@gmail.com';
  console.log(`Updating alumnus ahmad@gmail.com to ${testEmail}...`);
  
  const [result] =PS C:\Users\ramac\Downloads\tracer study (3)\tracer study> Get-Content src\controllers\admin\pengingatController.js
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

/* â”€â”€ GET /admin/pengingat â”€â”€ */
exports.index = (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 5;
  const offset = (page - 1) * limit;

  db.query(
    'SELECT * FROM pengingat WHERE admin_id = ? ORDER BY id DESC LIMIT ? OFFSET ?',
    [req.session.adminId, limit, offset],
    (err, rows) => {
      if (err) console.error('DB error pengingat index:', err.message);

      // Hitung metrik real dari database
      db.query(
        `SELECT 
           COUNT(*) AS totalAll,
           SUM(CASE WHEN status = 'TERKIRIM' THEN 1 ELSE 0 END) AS totalTerkirim,
           SUM(CASE WHEN status = 'GAGAL' THEN 1 ELSE 0 END)AS totalGagal
         FROM pengingat WHERE admin_id = ?`,
        [req.session.adminId],
        (err2, countRows) => {
          const stats = (countRows && countRows[0]) ? countRows[0] : { totalAll: 0, totalTerkirim: 0, totalGagal: 0 };
          const totalRows = stats.totalAll || 0;
          const totalPages = Math.ceil(totalRows / limit) ||1;

          const rawPenerimaDetail = req.flash('penerimaDetail')[0] || null;
          let penerimaDetail = [];
          if (rawPenerimaDetail) {
            try { penerimaDetail = JSON.parse(rawPenerimaDetail); } catch(e) {}
          }

          res.render('admin/pengingat', {
            title: 'Notifikasi Pengingat Alumni',
            adminName: req.session.adminName,
            pengingatList: rows || [],
            totalTerkirim: stats.totalTerkirim || 0,
            totalGagal: stats.totalGagal || 0,
            totalRows,
            currentPage: page,
            totalPages,
            penerimaDetail
          });
        }
      );
    }
  );
};

/* â”€â”€ POST /admin/pengingat â”€â”€ */
exports.tambah = (req, res) => {
  const { judul, target_alumni, saluran, pesan } = req.body;
  const saluranSelected = saluran || 'Email & WhatsApp';

  if (!judul || !target_alumni || !pesan) {
    req.flash('error', 'âš ï¸ Semua kolom formulir pengingatwajib diisi.');
    return res.redirect('/admin/pengingat');
  }

  // Cari target email & no_hp
  let targetQuery = '';
  if (target_alumni === 'Belum Mengisi Kuesioner') {
    targetQuery = 'SELECT DISTINCT a.id, a.email, a.no_hp, a.nama FROM alumni a LEFT JOIN tracer_study ts ON ts.alumni_id= a.id WHERE ts.id IS NULL AND a.is_active = 1';
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

    // Jika tidak ada alumni target
    if (alumniList.length === 0) {
      const detailPenerimaJson = JSON.stringify([]);
      db.query(
        `INSERT INTO pengingat (admin_id, judul, target_alumni, saluran, pesan, status, detail_penerima) VALUES (?, ?, ?,?, ?, 'GAGAL', ?)`,
        [req.session.adminId, judul.trim(), target_alumni, saluranSelected, pesan.trim(), detailPenerimaJson],
        () => {
          req.flash('error', `â Email send error:', mailErr.message);
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
        } catch (waErr) {
          console.error('âš ï¸ WhatsApp Gateway error:', waErr.message);
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
      `INSERT INTO pengingat (admin_id, judul, target_alumni, saluran, pesan, status, detail_penerima) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.session.adminId, judul.trim(), target_alumni, saluranSelected, pesan.trim(), statusText, detailPenerimaJson],
      (err) => {
        if (err) console.error('DB error kirim pengingat:', err.message);
        req.flash('penerimaDetail', detailPenerimaJson);
        res.redirect('/admin/pengingat');
      }
    );
  });
};

/* â”€â”€ POST /admin/pengingat/:id/hapus â”€â”€ */
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
 tracerstudy> await connection.execute(
    'UPDATE alumni SET email = ? WHERE nim = ?',
    [testEmail, '190101001']
  );

  console.log(`✅ Update successful! Rows affected: ${result.affectedRows}`);
  await connection.end();
}

run().catch(err => {
  console.error('❌ Error updating email:', err);
  process.exit(1);
});
