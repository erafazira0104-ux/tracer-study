/**
 * Database Initializer & Seeder
 * Run this file using: node src/configs/initDb.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

async function initialize() {
  const host = process.env.DB_HOST || 'localhost';
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'tracer_study';

  console.log(`Connecting to MySQL host: ${host} as user: ${user}...`);

  // Step 1: Connect to MySQL server without database first
  const connection = await mysql.createConnection({ host, user, password });

  // Create database if not exists
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\`;`);
  console.log(`✅ Database '${database}' checked/created.`);
  await connection.end();

  // Step 2: Connect to the specific database to create tables
  const db = await mysql.createConnection({ host, user, password, database });
  console.log(`Connected to database '${database}'. Initializing tables...`);

  // 1. admin table
  await db.query(`
    CREATE TABLE IF NOT EXISTS admin (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      nama VARCHAR(100) NOT NULL,
      email VARCHAR(100) UNIQUE,
      nuptk VARCHAR(50) UNIQUE,
      prodi VARCHAR(100) NULL,
      role VARCHAR(50) DEFAULT 'Super Admin',
      foto VARCHAR(255) NULL,
      terakhir_login VARCHAR(100) NULL,
      pengingat_otomatis TINYINT(1) DEFAULT 1,
      pengingat_frekuensi VARCHAR(50) DEFAULT 'Setiap 3 Bulan',
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );
  `);
  console.log(' - Table admin initialized.');

  // 2. alumni table
  await db.query(`
    CREATE TABLE IF NOT EXISTS alumni (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nim VARCHAR(50) UNIQUE NOT NULL,
      nama VARCHAR(100) NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      no_hp VARCHAR(20) NULL,
      jenis_kelamin ENUM('L', 'P') NULL,
      tempat_lahir VARCHAR(100) NULL,
      tanggal_lahir DATE NULL,
      alamat TEXT NULL,
      ipk_terakhir DECIMAL(3,2) NULL,
      fakultas VARCHAR(100) NULL,
      program_studi VARCHAR(100) NULL,
      tahun_masuk INT NULL,
      tahun_lulus INT NULL,
      angkatan VARCHAR(10) NULL,
      is_active TINYINT(1) DEFAULT 1,
      last_login TIMESTAMP NULL DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );
  `);
  console.log(' - Table alumni initialized.');

  // Migrate alumni table to make tahun_lulus nullable
  try {
    await db.query(`ALTER TABLE alumni MODIFY COLUMN tahun_lulus year(4) NULL;`);
    console.log(' - Migrated alumni.tahun_lulus column to nullable.');
  } catch (e) {
    console.error('Error modifying alumni.tahun_lulus:', e.message);
  }

  // 3. lowongan table
  await db.query(`
    CREATE TABLE IF NOT EXISTS lowongan (
      id INT AUTO_INCREMENT PRIMARY KEY,
      admin_id INT NULL,
      judul VARCHAR(150) NOT NULL,
      perusahaan VARCHAR(150) NOT NULL,
      lokasi VARCHAR(100) NULL,
      tipe ENUM('full_time', 'part_time', 'internship', 'freelance', 'contract', 'magang') DEFAULT 'full_time',
      deskripsi TEXT NULL,
      persyaratan TEXT NULL,
      gaji VARCHAR(50) NULL,
      deadline DATE NULL,
      gambar VARCHAR(255) NULL,
      link VARCHAR(255) NULL,
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (admin_id) REFERENCES admin(id) ON DELETE SET NULL
    );
  `);
  console.log(' - Table lowongan initialized.');

  // 4. konseling table
  await db.query(`
    CREATE TABLE IF NOT EXISTS konseling (
      id INT AUTO_INCREMENT PRIMARY KEY,
      admin_id INT NULL,
      judul VARCHAR(150) NOT NULL,
      deskripsi TEXT NULL,
      tanggal DATE NOT NULL,
      waktu_mulai TIME NOT NULL,
      waktu_selesai TIME NOT NULL,
      kuota INT DEFAULT 10,
      lokasi VARCHAR(150) NULL,
      tipe ENUM('online', 'offline') DEFAULT 'offline',
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (admin_id) REFERENCES admin(id) ON DELETE SET NULL
    );
  `);
  console.log(' - Table konseling initialized.');

  // 5. permintaan_konseling table
  await db.query(`
    CREATE TABLE IF NOT EXISTS permintaan_konseling (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nama_alumni VARCHAR(100) NOT NULL,
      nim VARCHAR(50) NULL,
      tahun_lulus INT NULL,
      konselor_id INT NULL,
      topik TEXT NOT NULL,
      status ENUM('belum_dilayani', 'sudah_dilayani') DEFAULT 'belum_dilayani',
      catatan_admin TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (konselor_id) REFERENCES konselor(id) ON DELETE SET NULL
    );
  `);
  console.log(' - Table permintaan_konseling initialized.');

  // 6. konseling_booking table
  await db.query(`
    CREATE TABLE IF NOT EXISTS konseling_booking (
      id INT AUTO_INCREMENT PRIMARY KEY,
      konseling_id INT NOT NULL,
      alumni_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (konseling_id) REFERENCES konseling(id) ON DELETE CASCADE,
      FOREIGN KEY (alumni_id) REFERENCES alumni(id) ON DELETE CASCADE
    );
  `);
  console.log(' - Table konseling_booking initialized.');

  // 7. tracer_study table
  await db.query(`
    CREATE TABLE IF NOT EXISTS tracer_study (
      id INT AUTO_INCREMENT PRIMARY KEY,
      alumni_id INT UNIQUE NOT NULL,
      status_pekerjaan ENUM('bekerja', 'wirausaha', 'kuliah', 'belum_bekerja') NOT NULL,
      nama_perusahaan VARCHAR(150) NULL,
      jabatan VARCHAR(100) NULL,
      bidang_perusahaan VARCHAR(100) NULL,
      lokasi_perusahaan VARCHAR(100) NULL,
      gaji_pertama VARCHAR(50) NULL,
      lama_mencari_kerja VARCHAR(50) NULL,
      media_mencari_kerja VARCHAR(100) NULL,
      kesesuaian_bidang VARCHAR(50) NULL,
      nama_universitas VARCHAR(150) NULL,
      program_studi_lanjut VARCHAR(100) NULL,
      jenjang_lanjut VARCHAR(50) NULL,
      kompetensi_relevan TEXT NULL,
      kepuasan_layanan INT NULL,
      saran TEXT NULL,
      status_kerja_detail VARCHAR(100) NULL,
      kepuasan_kurikulum VARCHAR(100) NULL,
      eval_kurikulum INT NULL,
      eval_dosen INT NULL,
      eval_fasilitas INT NULL,
      eval_pelayanan INT NULL,
      eval_mbkm INT NULL,
      tanggal_isi TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (alumni_id) REFERENCES alumni(id) ON DELETE CASCADE
    );
  `);
  console.log(' - Table tracer_study initialized.');

  // Migration: Support continuous/recurring tracer study (multi-entry per alumni)
  try {
    // 1. Drop UNIQUE constraint on alumni_id so one alumni can have multiple entries
    const [indexes] = await db.query(`SHOW INDEX FROM tracer_study WHERE Column_name = 'alumni_id' AND Non_unique = 0`);
    for (const idx of indexes) {
      if (idx.Key_name !== 'PRIMARY') {
        await db.query(`ALTER TABLE tracer_study DROP INDEX \`${idx.Key_name}\``);
        console.log(` - Dropped UNIQUE index '${idx.Key_name}' on tracer_study.alumni_id`);
      }
    }
  } catch (e) {
    // Index may not exist or already dropped
  }

  try {
    // 2. Add 'periode' column if not exists
    const [cols] = await db.query(`SHOW COLUMNS FROM tracer_study LIKE 'periode'`);
    if (cols.length === 0) {
      await db.query(`ALTER TABLE tracer_study ADD COLUMN periode VARCHAR(20) NULL AFTER alumni_id`);
      // Backfill existing rows with year from tanggal_isi
      await db.query(`UPDATE tracer_study SET periode = YEAR(tanggal_isi) WHERE periode IS NULL`);
      console.log(' - Added tracer_study.periode column.');
    }
  } catch (e) {
    console.error('Migration error (periode):', e.message);
  }

  try {
    // 3. Add 'pengisian_ke' column if not exists
    const [cols2] = await db.query(`SHOW COLUMNS FROM tracer_study LIKE 'pengisian_ke'`);
    if (cols2.length === 0) {
      await db.query(`ALTER TABLE tracer_study ADD COLUMN pengisian_ke INT DEFAULT 1 AFTER periode`);
      console.log(' - Added tracer_study.pengisian_ke column.');
    }
  } catch (e) {
    console.error('Migration error (pengisian_ke):', e.message);
  }

  try {
    // 4. Fix tanggal_isi to not auto-update (preserve original submission date)
    await db.query(`ALTER TABLE tracer_study MODIFY COLUMN tanggal_isi TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
    console.log(' - Fixed tracer_study.tanggal_isi (no auto-update).');
  } catch (e) {
    console.error('Migration error (tanggal_isi):', e.message);
  }

  // Migration: Add new "Bekerja" detail columns
  const bekerjaNewCols = [
    { name: 'kapan_mulai_cari_kerja', def: 'TEXT NULL' },
    { name: 'jenis_instansi', def: 'VARCHAR(100) NULL' },
    { name: 'penghasilan_bulanan', def: 'VARCHAR(100) NULL' },
    { name: 'kesesuaian_kompetensi', def: 'INT NULL' },
    { name: 'pendidikan_minimal_s1', def: 'VARCHAR(50) NULL' },
  ];
  for (const col of bekerjaNewCols) {
    try {
      const [colCheck] = await db.query(`SHOW COLUMNS FROM tracer_study LIKE '${col.name}'`);
      if (colCheck.length === 0) {
        await db.query(`ALTER TABLE tracer_study ADD COLUMN ${col.name} ${col.def}`);
        console.log(` - Added tracer_study.${col.name} column.`);
      }
    } catch (e) {
      console.error(`Migration error (${col.name}):`, e.message);
    }
  }

  // 8. kuesioner_pertanyaan table
  await db.query(`
    CREATE TABLE IF NOT EXISTS kuesioner_pertanyaan (
      id INT AUTO_INCREMENT PRIMARY KEY,
      kategori VARCHAR(100) NOT NULL,
      pertanyaan TEXT NOT NULL,
      jenis_jawaban ENUM('pilihan_ganda', 'essay') DEFAULT 'essay',
      opsi_jawaban TEXT NULL,
      is_active TINYINT(1) DEFAULT 1,
      urutan INT DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );
  `);
  console.log(' - Table kuesioner_pertanyaan initialized.');

  // Migrate existing table enum to varchar if needed
  try {
    await db.query(`ALTER TABLE kuesioner_pertanyaan MODIFY COLUMN kategori VARCHAR(100) NOT NULL;`);
    console.log(' - Migrated kuesioner_pertanyaan.kategori column to VARCHAR(100).');
  } catch (e) {
    // If table wasn't created yet or other error
  }

  // 8b. tracer_kategori table
  await db.query(`
    CREATE TABLE IF NOT EXISTS tracer_kategori (
      id INT AUTO_INCREMENT PRIMARY KEY,
      slug VARCHAR(100) UNIQUE NOT NULL,
      nama VARCHAR(100) NOT NULL,
      icon VARCHAR(50) NULL,
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log(' - Table tracer_kategori initialized.');

  // Seeding default categories
  const [katCheck] = await db.execute('SELECT COUNT(*) AS total FROM tracer_kategori');
  if (katCheck[0].total === 0) {
    await db.execute(`
      INSERT INTO tracer_kategori (slug, nama, icon) VALUES
      ('bekerja', 'Bekerja', '💼'),
      ('wirausaha', 'Wirausaha', '🏪'),
      ('kuliah', 'Studi Lanjut', '🎓'),
      ('belum_bekerja', 'Belum Bekerja', '👤')
    `);
    console.log(' ✅ Default categories seeded.');
  }

  // 9. pengingat table
  await db.query(`
    CREATE TABLE IF NOT EXISTS pengingat (
      id INT AUTO_INCREMENT PRIMARY KEY,
      admin_id INT NOT NULL,
      judul VARCHAR(255) NOT NULL,
      target_alumni VARCHAR(50) NOT NULL DEFAULT 'Semua Alumni',
      pesan TEXT NULL,
      status VARCHAR(50) DEFAULT 'TERKIRIM',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (admin_id) REFERENCES admin(id) ON DELETE CASCADE
    );
  `);
  console.log(' - Table pengingat initialized.');

  // 10. konselor table
  await db.query(`
    CREATE TABLE IF NOT EXISTS konselor (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nama VARCHAR(150) NOT NULL,
      bidang_keahlian VARCHAR(150) NOT NULL,
      foto VARCHAR(255) NULL,
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log(' - Table konselor initialized.');

  // 11. lowongan_access table
  await db.query(`
    CREATE TABLE IF NOT EXISTS lowongan_access (
      id INT AUTO_INCREMENT PRIMARY KEY,
      alumni_id INT NULL,
      nama VARCHAR(100) NOT NULL,
      nim VARCHAR(50) NULL,
      email VARCHAR(100) NOT NULL,
      no_hp VARCHAR(20) NULL,
      lowongan_id INT UNSIGNED NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (alumni_id) REFERENCES alumni(id) ON DELETE SET NULL,
      FOREIGN KEY (lowongan_id) REFERENCES lowongan(id) ON DELETE CASCADE
    );
  `);
  console.log(' - Table lowongan_access initialized.');

  // 12. tracer_periode table
  await db.query(`
    CREATE TABLE IF NOT EXISTS tracer_periode (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nama VARCHAR(100) NOT NULL,
      tanggal_mulai DATETIME NOT NULL,
      tanggal_selesai DATETIME NOT NULL,
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log(' - Table tracer_periode initialized.');

  // Seeding default Period if empty
  const [periodeCheck] = await db.execute('SELECT COUNT(*) AS total FROM tracer_periode');
  if (periodeCheck[0].total === 0) {
    const now = new Date();
    const twoWeeksLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    // Format to MySQL datetime strings
    const startStr = now.toISOString().slice(0, 19).replace('T', ' ');
    const endStr = twoWeeksLater.toISOString().slice(0, 19).replace('T', ' ');
    await db.execute(`
      INSERT INTO tracer_periode (nama, tanggal_mulai, tanggal_selesai, is_active) VALUES
      ('Periode Ganjil 2026', ?, ?, 1)
    `, [startStr, endStr]);
    console.log(' ✅ Default active period seeded.');
  }

  // 13. tracer_pengaturan table (Tracer Study general settings)
  await db.query(`
    CREATE TABLE IF NOT EXISTS tracer_pengaturan (
      id INT AUTO_INCREMENT PRIMARY KEY,
      kunci VARCHAR(100) UNIQUE NOT NULL,
      nilai VARCHAR(255) NOT NULL,
      keterangan TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log(' - Table tracer_pengaturan initialized.');

  // Seed default cooldown if empty
  const [settingCheck] = await db.execute('SELECT COUNT(*) AS total FROM tracer_pengaturan WHERE kunci = "cooldown_bulan"');
  if (settingCheck[0].total === 0) {
    await db.execute(`
      INSERT INTO tracer_pengaturan (kunci, nilai, keterangan) VALUES
      ('cooldown_bulan', '3', 'Jeda minimum antar pengisian kuesioner tracer study (dalam satuan bulan)')
    `);
    console.log(' ✅ Default cooldown_bulan setting seeded.');
  }

  // Seeding default Admin
  const adminPassword = await bcrypt.hash('admin123', 10);
  const [adminCheck] = await db.execute('SELECT id FROM admin WHERE username = ?', ['admin']);
  if (adminCheck.length === 0) {
    await db.execute(
      'INSERT INTO admin (username, password, nama, email) VALUES (?, ?, ?, ?)',
      ['admin', adminPassword, 'Admin IS', 'admin@hamzanwadi.ac.id']
    );
    console.log('✅ Admin account seeded: admin / admin123');
  }

  // Seeding default Alumni
  const alumniPassword = await bcrypt.hash('alumni123', 10);
  const dummyAlumni = [
    ['190101001', 'Ahmad Hidayat', 'ahmad@gmail.com', alumniPassword, '081234567890', 'L', 'Mataram', '2001-05-15', 'Jl. Pendidikan No. 10', 3.75, 'Fakultas Teknik', 'Sistem Informasi', 2019, 2023, '2019'],
    ['190101015', 'Siti Rahmawati', 'siti@gmail.com', alumniPassword, '081234567891', 'P', 'Selong', '2001-08-20', 'Jl. Merdeka No. 4', 3.85, 'Fakultas Teknik', 'Sistem Informasi', 2019, 2023, '2019'],
    ['180101042', 'Budi Pratama', 'budi@gmail.com', alumniPassword, '081234567892', 'L', 'Pancor', '2000-02-10', 'Jl. Gajah Mada No. 12', 3.45, 'Fakultas Teknik', 'Sistem Informasi', 2018, 2022, '2018'],
    ['190101088', 'Lalu Arisandi', 'arisandi@gmail.com', alumniPassword, '081234567893', 'L', 'Kopang', '2001-11-25', 'Jl. Ki Hajar Dewantara', 3.60, 'Fakultas Teknik', 'Sistem Informasi', 2019, 2023, '2019'],
    ['180101121', 'Dewi Wijaya', 'dewi@gmail.com', alumniPassword, '081234567894', 'P', 'Mataram', '2000-09-05', 'Jl. Hasanuddin No. 3', 3.90, 'Fakultas Teknik', 'Sistem Informasi', 2018, 2022, '2018']
  ];

  for (const al of dummyAlumni) {
    const [alumniCheck] = await db.execute('SELECT id FROM alumni WHERE nim = ?', [al[0]]);
    if (alumniCheck.length === 0) {
      await db.execute(`
        INSERT INTO alumni (
          nim, nama, email, password, no_hp, jenis_kelamin, tempat_lahir,
          tanggal_lahir, alamat, ipk_terakhir, fakultas, program_studi,
          tahun_masuk, tahun_lulus, angkatan
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, al);
    }
  }
  console.log('✅ Dummy alumni seeded (password: alumni123).');

  // Seeding default kuesioner_pertanyaan if empty
  const [questionsCheck] = await db.execute('SELECT COUNT(*) AS total FROM kuesioner_pertanyaan');
  if (questionsCheck[0].total === 0) {
    const defaultQuestions = [
      // bekerja
      ['bekerja', 'Apa nama instansi/perusahaan tempat Anda bekerja?', 'essay', null, 1],
      ['bekerja', 'Berapa gaji bulanan pertama Anda?', 'pilihan_ganda', JSON.stringify(['< 3 Juta', '3 - 5 Juta', '5 - 10 Juta', '> 10 Juta']), 2],
      ['bekerja', 'Seberapa sesuai bidang pekerjaan Anda dengan program studi?', 'pilihan_ganda', JSON.stringify(['Sangat Sesuai', 'Sesuai', 'Kurang Sesuai', 'Tidak Sesuai']), 3],
      // wirausaha
      ['wirausaha', 'Apa bidang usaha yang Anda jalankan?', 'essay', null, 1],
      ['wirausaha', 'Berapa rata-rata omset bulanan usaha Anda?', 'pilihan_ganda', JSON.stringify(['< 5 Juta', '5 - 15 Juta', '15 - 50 Juta', '> 50 Juta']), 2],
      // kuliah
      ['kuliah', 'Di universitas mana Anda melanjutkan studi?', 'essay', null, 1],
      ['kuliah', 'Apa program studi yang Anda ambil?', 'essay', null, 2],
      // belum_bekerja
      ['belum_bekerja', 'Apa kendala utama Anda dalam mencari pekerjaan?', 'essay', null, 1]
    ];
    for (const q of defaultQuestions) {
      await db.execute(`
        INSERT INTO kuesioner_pertanyaan (kategori, pertanyaan, jenis_jawaban, opsi_jawaban, urutan)
        VALUES (?, ?, ?, ?, ?)
      `, q);
    }
    console.log('✅ Default kuesioner_pertanyaan seeded.');
  }

  // Seed Tracer study answers for some dummy alumni to show dashboard statistics
  const [tracerCheck] = await db.execute('SELECT COUNT(*) AS total FROM tracer_study');
  if (tracerCheck[0].total === 0) {
    // We will query alumni IDs
    const [alumniRows] = await db.execute('SELECT id, nim FROM alumni');
    const alumniMap = {};
    alumniRows.forEach(row => alumniMap[row.nim] = row.id);

    const dummyTracer = [
      [alumniMap['190101001'], 'bekerja', 'PT Teknologi Nusantara', 'Frontend Developer', 'IT', 'Mataram', '5 - 10 Juta', 'Kurang dari 3 bulan', 'Portal Karir Kampus', 'Sangat Sesuai', 5, 'Sangat puas', 'Sangat Sesuai', 5, 5, 5, 5, 5],
      [alumniMap['180101042'], 'bekerja', 'CV Digital Solusi', 'Data Analyst', 'IT', 'Lombok Timur', '3 - 5 Juta', '3-6 bulan', 'Media Sosial', 'Sesuai', 4, 'Cukup puas', 'Sesuai', 4, 4, 4, 4, 4],
      [alumniMap['180101121'], 'wirausaha', 'Dewi Cafe & Bakery', 'Owner', 'F&B', 'Mataram', '5 - 10 Juta', 'Kurang dari 3 bulan', 'Lainnya', 'Tidak Sesuai', 4, 'Bagus sekali', 'Sangat Sesuai', 5, 4, 5, 4, 5]
    ];

    for (const tr of dummyTracer) {
      if (tr[0]) {
        await db.execute(`
          INSERT INTO tracer_study (
            alumni_id, status_pekerjaan, nama_perusahaan, jabatan, bidang_perusahaan, lokasi_perusahaan,
            gaji_pertama, lama_mencari_kerja, media_mencari_kerja, kesesuaian_bidang, kepuasan_layanan, saran,
            kepuasan_kurikulum, eval_kurikulum, eval_dosen, eval_fasilitas, eval_pelayanan, eval_mbkm
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, tr);
      }
    }
    console.log('✅ Dummy tracer study answers seeded.');
  }

  // Seed default lowongan
  const [lowonganCheck] = await db.execute('SELECT COUNT(*) AS total FROM lowongan');
  const [adminRow] = await db.execute('SELECT id FROM admin WHERE username = ?', ['admin']);
  const adminId = adminRow[0].id;
  if (lowonganCheck[0].total === 0) {
    await db.execute(`
      INSERT INTO lowongan (admin_id, judul, perusahaan, lokasi, tipe, deskripsi, persyaratan, gaji, deadline, link)
      VALUES
      (?, 'Senior Backend Engineer', 'PT GoTo Gojek Tokopedia', 'Jakarta (Remote)', 'full_time', 'Mengembangkan backend service berskala besar.', 'Pengalaman Node.js/Go minimal 3 tahun.', 'Rp 15.000.000 - 25.000.000', '2026-09-30', 'https://www.gotocompany.com/careers'),
      (?, 'Mobile Developer', 'PT Shopee International', 'Mataram, NTB', 'full_time', 'Membangun aplikasi mobile iOS dan Android menggunakan Flutter.', 'Pengalaman Flutter minimal 2 tahun.', 'Rp 8.000.000 - 12.000.000', '2026-08-31', 'https://careers.shopee.co.id'),
      (?, 'IT Support Internship', 'Dinas Komunikasi dan Informatika', 'Selong, Lombok Timur', 'magang', 'Melakukan pemeliharaan perangkat IT instansi.', 'Fresh graduate atau mahasiswa tingkat akhir.', 'Rp 1.500.000', '2026-07-25', 'https://diskominfo.lomboktimurkab.go.id')
    `, [adminId, adminId, adminId]);
    console.log('✅ Dummy lowongan seeded.');
  }

  // Update existing lowongan rows without valid links
  try {
    await db.execute(`UPDATE lowongan SET link = 'https://si.ft.hamzanwadi.ac.id' WHERE link IS NULL OR link = '' OR link = '#'`);
    console.log(' - Updated existing lowongan null/empty links with default URL.');
  } catch (e) {
    // Ignore error
  }

  // Seed default konseling
  const [konselingCheck] = await db.execute('SELECT COUNT(*) AS total FROM konseling');
  if (konselingCheck[0].total === 0) {
    await db.execute(`
      INSERT INTO konseling (admin_id, judul, deskripsi, tanggal, waktu_mulai, waktu_selesai, kuota, lokasi, tipe)
      VALUES
      (?, 'Persiapan CV Profesional & Portofolio', 'Bimbingan teknik menulis CV ATS-friendly dan menyusun portofolio.', '2026-07-20', '09:00:00', '11:00:00', 10, 'Gedung Rektorat Lt. 2', 'offline'),
      (?, 'Simulasi Wawancara Kerja (Mock Interview)', 'Sesi latihan wawancara dalam bahasa Indonesia dan Inggris.', '2026-07-27', '13:00:00', '15:00:00', 15, 'https://meet.google.com/tracer-interview', 'online')
    `, [adminId, adminId]);
    console.log('✅ Dummy sessions for konseling seeded.');
  }

  // Seed default konselor
  const [konselorCheck] = await db.execute('SELECT COUNT(*) AS total FROM konselor');
  if (konselorCheck[0].total === 0) {
    await db.execute(`
      INSERT INTO konselor (nama, bidang_keahlian, is_active)
      VALUES
      ('Ahmad Naufal, M.T.', 'Software Engineering & Cloud Computing', 1),
      ('Siti Khadijah, M.Kom.', 'Data Science & Artificial Intelligence', 1),
      ('Budi Santoso, Ph.D.', 'IT Governance & Cybersecurity', 1)
    `);
    console.log('✅ Default counselors seeded.');
  }

  await db.end();
  console.log('🎉 Database initialization complete!');
}

initialize().catch(err => {
  console.error('❌ Database Initialization failed:', err);
  process.exit(1);
});
