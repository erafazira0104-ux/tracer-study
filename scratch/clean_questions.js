const db = require('../src/configs/db');

async function runCleanup() {
  console.log('Starting kuesioner_pertanyaan table cleanup...');

  const updates = [
    {
      sql: 'UPDATE kuesioner_pertanyaan SET is_active = 0 WHERE id = 14',
      desc: 'Deactivated redundant works status question (id 14).'
    },
    {
      sql: 'UPDATE kuesioner_pertanyaan SET opsi_jawaban = ? WHERE id = 16',
      params: [JSON.stringify(["Kurang dari 3 bulan", "3-6 bulan", "6-12 bulan", "Lebih dari 1 tahun"])],
      desc: 'Fixed duplicate options in works search duration question (id 16).'
    },
    {
      sql: 'UPDATE kuesioner_pertanyaan SET pertanyaan = ? WHERE id = 5',
      params: ['Berapa rata-rata omset bulanan usaha Anda?'],
      desc: 'Fixed typo (question mark) in entrepreneurship omset question (id 5).'
    },
    {
      sql: 'UPDATE kuesioner_pertanyaan SET pertanyaan = ?, jenis_jawaban = ?, opsi_jawaban = ? WHERE id = 17',
      params: [
        'Apa jenjang pendidikan lanjut yang Anda ambil?',
        'pilihan_ganda',
        JSON.stringify(["Magister (S2)", "Doktor (S3)", "Program Profesi", "Lainnya"])
      ],
      desc: 'Replaced junk question fgvhb (id 17) with study level question.'
    },
    {
      sql: 'UPDATE kuesioner_pertanyaan SET pertanyaan = ?, jenis_jawaban = ?, opsi_jawaban = NULL WHERE id = 19',
      params: [
        'Apa nama usaha/perusahaan yang Anda jalankan?',
        'essay'
      ],
      desc: 'Replaced junk question ghuj (id 19) with entrepreneurship company name.'
    },
    {
      sql: 'UPDATE kuesioner_pertanyaan SET pertanyaan = ?, jenis_jawaban = ?, opsi_jawaban = NULL WHERE id = 20',
      params: [
        'Apa posisi/peran Anda dalam usaha tersebut?',
        'essay'
      ],
      desc: 'Replaced junk question hbnj (id 20) with entrepreneurship role/position.'
    },
    {
      sql: 'UPDATE kuesioner_pertanyaan SET is_active = 0 WHERE id = 18',
      desc: 'Deactivated inactive junk question 5rt6yu (id 18).'
    }
  ];

  for (const item of updates) {
    try {
      await new Promise((resolve, reject) => {
        db.query(item.sql, item.params || [], (err, result) => {
          if (err) return reject(err);
          console.log(`✅ ${item.desc}`);
          resolve(result);
        });
      });
    } catch (e) {
      console.error(`❌ Failed to run: ${item.desc} | Error: ${e.message}`);
    }
  }

  console.log('Cleanup finished!');
  process.exit();
}

runCleanup();
