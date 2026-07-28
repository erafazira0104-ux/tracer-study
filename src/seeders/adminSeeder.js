/**
 * Admin Seeder
 * Jalankan: node src/seeders/adminSeeder.js
 * Akan membuat akun admin default:
 *   username : admin
 *   password : admin123
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const bcrypt   = require('bcrypt');
const mysql2   = require('mysql2/promise');

async function seed() {
  const db = await mysql2.createConnection({
    host    : process.env.DB_HOST     || 'localhost',
    user    : process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'tracer_study',
  });

  const plainPassword = 'admin123';
  const hash = await bcrypt.hash(plainPassword, 10);

  const [rows] = await db.execute('SELECT id FROM admin WHERE username = ?', ['admin']);
  if (rows.length > 0) {
    console.log('⚠️  Admin sudah ada, seeder dilewati.');
    await db.end();
    return;
  }

  await db.execute(
    'INSERT INTO admin (username, password, nama, email) VALUES (?, ?, ?, ?)',
    ['admin', hash, 'Administrator', 'admin@hamzanwadi.ac.id']
  );

  console.log('✅ Akun admin berhasil dibuat!');
  console.log('   Username : admin');
  console.log('   Password : admin123');

  // ---- Contoh alumni (password: alumni123) ----
  const alumniHash = await bcrypt.hash('alumni123', 10);

  const demoAlumni = [
    ['20010101','Ahmad Fauzi','ahmad@gmail.com', alumniHash,'081234567890',2020,2024,'2020','L'],
    ['20010102','Siti Rahayu','siti@gmail.com',  alumniHash,'081234567891',2020,2024,'2020','P'],
    ['19010101','Budi Santoso','budi@gmail.com', alumniHash,'081234567892',2019,2023,'2019','L'],
  ];

  for (const al of demoAlumni) {
    const [exists] = await db.execute('SELECT id FROM alumni WHERE nim = ?', [al[0]]);
    if (exists.length === 0) {
      await db.execute(
        `INSERT INTO alumni (nim, nama, email, password, no_hp, tahun_masuk, tahun_lulus, angkatan, jenis_kelamin)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        al
      );
    }
  }
  console.log('✅ Data alumni demo berhasil dibuat (password: alumni123)');

  // ---- Contoh lowongan ----
  const [adminRow] = await db.execute('SELECT id FROM admin WHERE username = ?', ['admin']);
  const adminId = adminRow[0].id;

  await db.execute(
    `INSERT INTO lowongan (admin_id, judul, perusahaan, lokasi, tipe, deskripsi, persyaratan, gaji, deadline)
     VALUES
     (?, 'Frontend Developer', 'PT Teknologi Nusantara', 'Mataram, NTB', 'full_time',
      'Mencari Frontend Developer yang berpengalaman dalam React.js / Vue.js.',
      'S1 Sistem Informasi. Menguasai HTML, CSS, JS, React/Vue. Min 1 tahun pengalaman.',
      'Rp 4.000.000 - 7.000.000', '2026-08-31'),
     (?, 'Data Analyst', 'CV Digital Solusi', 'Lombok Timur, NTB', 'full_time',
      'Posisi Data Analyst untuk menganalisis data bisnis dan insight strategis.',
      'S1 Sistem Informasi/Statistik. Kuasai SQL, Python, visualisasi data.',
      'Rp 3.500.000 - 6.000.000', '2026-08-15'),
     (?, 'IT Support Magang', 'Dinas Kominfo NTB', 'Mataram, NTB', 'magang',
      'Program magang IT Support di Pemerintah Provinsi NTB.',
      'Fresh graduate/mahasiswa SI/TI. Komunikatif dan bertanggung jawab.',
      'Rp 1.000.000 - 1.500.000', '2026-07-31')`,
    [adminId, adminId, adminId]
  );
  console.log('✅ Data lowongan demo berhasil dibuat');

  // ---- Contoh sesi konseling ----
  await db.execute(
    `INSERT INTO konseling (admin_id, judul, deskripsi, tanggal, waktu_mulai, waktu_selesai, kuota, lokasi, tipe)
     VALUES
     (?, 'Konseling Karir: Memilih Karir di Bidang IT',
      'Sesi untuk alumni yang ingin berkonsultasi mengenai pilihan karir IT.',
      '2026-07-20','09:00:00','11:00:00', 15,
      'Ruang Konseling Fakultas Teknik, Gedung B Lt.2','offline'),
     (?, 'Workshop CV & Interview',
      'Bimbingan membuat CV profesional dan tips interview.',
      '2026-07-25','13:00:00','15:00:00', 20,
      'https://meet.google.com/tracer-hamzanwadi','online')`,
    [adminId, adminId]
  );
  console.log('✅ Data sesi konseling demo berhasil dibuat');

  await db.end();
  console.log('\n🎉 Seeder selesai! Jalankan: node index.js');
}

seed().catch(err => {
  console.error('❌ Seeder error:', err.message);
  process.exit(1);
});
