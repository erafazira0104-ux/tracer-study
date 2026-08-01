const db = require('../configs/db');

const getGreeting = (name) => {
  if (!name) return { title: 'Bapak/Ibu', shortTitle: 'Pak/Bu' };
  const lower = name.toLowerCase();
  if (
    lower.includes('ibu') ||
    lower.includes('era') ||
    lower.includes('siti') ||
    lower.includes('khadijah') ||
    lower.includes('dewi') ||
    lower.includes('putri') ||
    lower.includes('rahma') ||
    lower.includes('fazira')
  ) {
    return { title: 'Ibu', shortTitle: 'Bu' };
  }
  if (
    lower.includes('bapak') ||
    lower.includes('pak') ||
    lower.includes('ahmad') ||
    lower.includes('budi') ||
    lower.includes('muhammad') ||
    lower.includes('saiful') ||
    lower.includes('amri') ||
    lower.includes('naufal')
  ) {
    return { title: 'Bapak', shortTitle: 'Pak' };
  }
  return { title: 'Bapak/Ibu', shortTitle: 'Pak/Bu' };
};

const formatWa = (waStr) => {
  if (!waStr) return null;
  let clean = String(waStr).replace(/[^0-9]/g, '');
  if (clean.startsWith('0')) {
    clean = '62' + clean.slice(1);
  } else if (clean.startsWith('8')) {
    clean = '62' + clean;
  }
  return clean || null;
};

const getFallbackWa = (callback) => {
  db.query(
    'SELECT * FROM konselor WHERE is_active = 1 AND whatsapp IS NOT NULL AND whatsapp != "" LIMIT 1',
    [],
    (e1, r1) => {
      if (!e1 && r1 && r1.length > 0 && r1[0].whatsapp) {
        return callback(formatWa(r1[0].whatsapp), r1[0].nama);
      }
      db.query(
        'SELECT nilai FROM tracer_pengaturan WHERE kunci = "whatsapp_admin"',
        [],
        (e2, r2) => {
          const adminWa = (!e2 && r2 && r2.length > 0 && r2[0].nilai) ? formatWa(r2[0].nilai) : '6281936791163';
          callback(adminWa, '');
        }
      );
    }
  );
};

const getRiwayatKonseling = (req, res) => {
  try {
    const requestId = req.query.request_id;
    const konselorId = req.query.konselor_id;

    const renderPage = (waNumber, namaKonselor, namaAlumni, tahunLulus) => {
      const g = getGreeting(namaKonselor);

      const alumniName = namaAlumni || '[Nama Alumni]';
      const angkatan = tahunLulus || '[Tahun]';
      const konselorName = namaKonselor || '[Nama Konselor]';

      db.query(
        'SELECT nilai FROM tracer_pengaturan WHERE kunci = "template_wa_konseling"',
        [],
        (errTpl, tplRows) => {
          let rawTemplate =
            `Assalamualaikum/Selamat pagi, {SAPAAN_KONSELOR} {NAMA_KONSELOR}.\n\n` +
            `Mohon maaf mengganggu waktunya, {SAPAAN_PENDEK}. Perkenalkan, saya {NAMA_ALUMNI}, alumni angkatan {TAHUN_LULUS}. Dengan hormat, saya ingin menyampaikan bahwa saya telah mengajukan permohonan konseling melalui Tracer Study.\n\n` +
            `Mohon kiranya {SAPAAN_KONSELOR} berkenan memberikan arahan mengenai proses atau langkah selanjutnya yang perlu saya lakukan. Atas perhatian dan kesediaan {SAPAAN_KONSELOR}, saya ucapkan terima kasih banyak.\n\n` +
            `Wassalamualaikum/Hormat saya,\n{NAMA_ALUMNI}`;

          if (!errTpl && tplRows && tplRows.length > 0 && tplRows[0].nilai) {
            rawTemplate = tplRows[0].nilai;
          }

          const messageText = rawTemplate
            .replace(/{NAMA_KONSELOR}/g, konselorName)
            .replace(/{SAPAAN_KONSELOR}/g, g.title)
            .replace(/{SAPAAN_PENDEK}/g, g.shortTitle)
            .replace(/{NAMA_ALUMNI}/g, alumniName)
            .replace(/{TAHUN_LULUS}/g, String(angkatan));

          res.render('riwayatkonseling', {
            title: 'Konsultasi Berhasil',
            activeNav: 'konseling',
            whatsappNumber: waNumber || '6281936791163',
            namaKonselor: namaKonselor || '',
            namaAlumni: namaAlumni || '',
            tahunLulus: tahunLulus || '',
            waMessageText: encodeURIComponent(messageText),
          });
        }
      );
    };

    // 1. Check if request_id is provided from form submit
    if (requestId) {
      db.query(
        `SELECT pk.*, k.nama AS nama_konselor, k.whatsapp AS whatsapp_konselor
         FROM permintaan_konseling pk
         LEFT JOIN konselor k ON k.id = pk.konselor_id
         WHERE pk.id = ?`,
        [requestId],
        (err, rows) => {
          if (!err && rows && rows.length > 0) {
            const pk = rows[0];
            let waNumber = formatWa(pk.whatsapp_konselor);
            
            if (waNumber) {
              return renderPage(waNumber, pk.nama_konselor, pk.nama_alumni, pk.tahun_lulus);
            }
            
            // If specific counselor has no whatsapp set, get fallback WhatsApp
            getFallbackWa((fallbackWa, fallbackName) => {
              renderPage(fallbackWa, fallbackName || pk.nama_konselor || '', pk.nama_alumni, pk.tahun_lulus);
            });
            return;
          }
          // If query error or not found, fallback to standard handling below
          fallbackToKonselor();
        }
      );
    } else {
      fallbackToKonselor();
    }

    function fallbackToKonselor() {
      if (konselorId) {
        db.query('SELECT * FROM konselor WHERE id = ?', [konselorId], (err, rows) => {
          if (!err && rows && rows.length > 0 && rows[0].whatsapp) {
            return renderPage(formatWa(rows[0].whatsapp), rows[0].nama, '', '');
          }
          getFallbackWa((fallbackWa, fallbackName) => {
            renderPage(fallbackWa, fallbackName || ((rows && rows[0]) ? rows[0].nama : ''), '', '');
          });
        });
      } else {
        getFallbackWa((fallbackWa, fallbackName) => {
          renderPage(fallbackWa, fallbackName, '', '');
        });
      }
    }
  } catch (err) {
    console.error('Error riwayat konseling:', err);
    res.status(500).send('Terjadi kesalahan server.');
  }
};

module.exports = { getRiwayatKonseling };