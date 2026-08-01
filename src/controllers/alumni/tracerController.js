/**
 * Alumni Tracer Study Controller
 * Supports continuous/recurring tracer study submissions with:
 * 1. Cooldown constraint (months) defined dynamically by the administrator in tracer_pengaturan
 * 2. Active period window constraint defined by the administrator in tracer_periode
 */
const db = require('../../configs/db');

/* ── GET /alumni/tracer ── */
exports.showForm = (req, res) => {
  const alumniId = req.session.alumniId;

  // Get active period defined by admin
  db.query('SELECT * FROM tracer_periode WHERE is_active = 1 LIMIT 1', [], (errPeriode, periodRows) => {
    if (errPeriode) return res.status(500).send('DB error (periode)');
    const activePeriod = periodRows.length > 0 ? periodRows[0] : null;

    // Get dynamic cooldown setting
    db.query("SELECT nilai FROM tracer_pengaturan WHERE kunci = 'cooldown_bulan' LIMIT 1", [], (errSetting, settingRows) => {
      if (errSetting) return res.status(500).send('DB error (pengaturan)');
      const cooldownBulan = parseInt(settingRows.length > 0 ? settingRows[0].nilai : '3');

      db.query('SELECT * FROM alumni WHERE id = ?', [alumniId], (errAlumni, alumniRows) => {
        if (errAlumni || alumniRows.length === 0) {
          return res.status(500).send('Terjadi kesalahan server.');
        }
        const alumni = alumniRows[0];

        // ── PROFILE COMPLETENESS CHECK ──
        const requiredFields = [
          { key: 'nama', label: 'Nama Lengkap' },
          { key: 'email', label: 'Email' },
          { key: 'no_hp', label: 'Nomor HP' },
          { key: 'program_studi', label: 'Program Studi' }
        ];
        const missingFields = requiredFields.filter(f => {
          const val = alumni[f.key];
          return val === null || val === undefined || String(val).trim() === '';
        });
        if (missingFields.length > 0) {
          const missingNames = missingFields.map(f => f.label).join(', ');
          req.session.flash_error = `⚠️ Profil Anda belum lengkap! Harap isi field berikut sebelum mengakses Kuesioner Tracer Study: ${missingNames}`;
          return res.redirect('/alumni/profile');
        }

        // Fetch ALL tracer study entries for this alumni, ordered by newest first
        db.query(
          'SELECT * FROM tracer_study WHERE alumni_id = ? ORDER BY tanggal_isi DESC',
          [alumniId],
          (err, rows) => {
            if (err) return res.status(500).send('DB error');

            const riwayatList = rows || [];
            const tracerTerbaru = riwayatList.length > 0 ? riwayatList[0] : null;
            const pengisianKe = riwayatList.length + 1;

            // Check if active period window is open strictly according to schedule
            const now = new Date();
            let isPeriodOpen = false;
            let periodOpenMessage = 'Masa pengisian kuesioner saat ini sedang ditutup oleh Admin. Harap tunggu jadwal resmi yang ditetapkan.';
            let namaPeriode = '';

            if (activePeriod) {
              namaPeriode = activePeriod.nama;
              const start = new Date(activePeriod.tanggal_mulai);
              const end = new Date(activePeriod.tanggal_selesai);
              if (now >= start && now <= end) {
                isPeriodOpen = true;
              } else if (now < start) {
                periodOpenMessage = `Masa pengisian untuk periode '${activePeriod.nama}' belum dimulai. (Jadwal: ${start.toLocaleString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })})`;
              } else {
                periodOpenMessage = `Masa pengisian untuk periode '${activePeriod.nama}' sudah berakhir pada ${end.toLocaleString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}.`;
              }
            }

            // Check if already submitted for this period
            let alreadySubmittedForPeriod = false;
            let periodSubmitMessage = '';

            if (activePeriod) {
              alreadySubmittedForPeriod = riwayatList.some(r => r.periode === activePeriod.nama);
              if (alreadySubmittedForPeriod) {
                periodSubmitMessage = `Anda sudah mengisi kuesioner Tracer Study untuk periode '${activePeriod.nama}'. Setiap alumni hanya diperbolehkan mengisi 1 kali per periode.`;
              }
            }

            // Cooldown check for information only if active period is open
            let coolDownOk = true;
            let coolDownMessage = '';
            let nextAvailableDate = null;

            if (tracerTerbaru) {
              const lastDate = new Date(tracerTerbaru.tanggal_isi);
              const cooldownMs = cooldownBulan * 30.44 * 24 * 60 * 60 * 1000;
              nextAvailableDate = new Date(lastDate.getTime() + cooldownMs);
              if (now < nextAvailableDate && !activePeriod) {
                coolDownOk = false;
                coolDownMessage = `Anda baru saja mengisi kuesioner pada ${lastDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}. Berdasarkan ketentuan yang diatur oleh Admin, pengisian berkala hanya dapat dilakukan minimal ${cooldownBulan} bulan sekali. Anda dapat mengisi kembali setelah tanggal ${nextAvailableDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}.`;
              }
            }

            // If active period is open and alumni hasn't submitted for this active period, submission is permitted!
            const canSubmit = isPeriodOpen && !alreadySubmittedForPeriod;

            // Fetch ALL active kuesioner pertanyaan
            db.query(
              'SELECT * FROM kuesioner_pertanyaan WHERE is_active = 1 ORDER BY urutan ASC, id ASC',
              [],
              (errQuestions, qRows) => {
                const questions = qRows || [];

                let jawabanKustomObj = {};
                if (tracerTerbaru && tracerTerbaru.jawaban_kustom) {
                  try {
                    jawabanKustomObj = JSON.parse(tracerTerbaru.jawaban_kustom);
                  } catch (e) {}
                }

                const getLegacyAnswer = (tracer, q) => {
                  if (!tracer) return '';
                  const text = (q.pertanyaan || '').toLowerCase();
                  if (q.kategori === 'bekerja') {
                    if (text.includes('saat ini sudah bekerja')) return tracer.status_pekerjaan === 'bekerja' ? 'Sudah bekerja' : (tracer.status_pekerjaan || '');
                    if (text.includes('kapan anda mulai mencari')) return tracer.kapan_mulai_cari_kerja || '';
                    if (text.includes('berapa lama') || text.includes('waktu yang dibutuhkan')) return tracer.lama_mencari_kerja || '';
                    if (text.includes('nama instansi') || text.includes('nama perusahaan')) return tracer.nama_perusahaan || '';
                    if (text.includes('jenis instansi')) return tracer.jenis_instansi || '';
                    if (text.includes('bidang usaha')) return tracer.bidang_perusahaan || '';
                    if (text.includes('jabatan')) return tracer.jabatan || '';
                    if (text.includes('lokasi')) return tracer.lokasi_perusahaan || '';
                    if (text.includes('status kepegawaian') || text.includes('status pekerjaan')) return tracer.status_kerja_detail || '';
                    if (text.includes('penghasilan pertama') || text.includes('gaji pertama')) return tracer.gaji_pertama || '';
                    if (text.includes('penghasilan anda saat ini') || text.includes('gaji saat ini')) return tracer.penghasilan_bulanan || '';
                    if (text.includes('sesuai dengan bidang studi') || text.includes('kesesuaian bidang')) return tracer.kesesuaian_bidang || '';
                    if (text.includes('kompetensi yang diperoleh')) return tracer.kesesuaian_kompetensi || '';
                  }
                  if (q.kategori === 'wirausaha') {
                    if (text.includes('memiliki usaha sendiri')) return tracer.status_pekerjaan === 'wirausaha' ? 'Sudah Memiliki Usaha' : '';
                    if (text.includes('nama usaha')) return tracer.nama_perusahaan || '';
                    if (text.includes('bidang usaha')) return tracer.bidang_perusahaan || '';
                    if (text.includes('tahun memulai')) return tracer.kapan_mulai_cari_kerja || '';
                    if (text.includes('jumlah karyawan')) return tracer.jabatan || '';
                    if (text.includes('omzet')) return tracer.gaji_pertama || tracer.penghasilan_bulanan || '';
                    if (text.includes('sumber modal')) return tracer.media_mencari_kerja || '';
                    if (text.includes('sesuai dengan bidang studi') || text.includes('kesesuaian')) return tracer.kesesuaian_bidang || '';
                    if (text.includes('perkuliahan membantu')) return tracer.kesesuaian_kompetensi || '';
                  }
                  if (q.kategori === 'kuliah') {
                    if (text.includes('melanjutkan pendidikan')) return tracer.status_pekerjaan === 'kuliah' ? 'Ya' : '';
                    if (text.includes('perguruan tinggi') || text.includes('universitas')) return tracer.nama_universitas || '';
                    if (text.includes('jenjang')) return tracer.jenjang_lanjut || '';
                    if (text.includes('program studi')) return tracer.program_studi_lanjut || '';
                    if (text.includes('tahun masuk')) return tracer.kapan_mulai_cari_kerja || '';
                    if (text.includes('alasan')) return tracer.saran || '';
                    if (text.includes('sumber pembiayaan')) return tracer.media_mencari_kerja || '';
                  }
                  if (q.kategori === 'belum_bekerja') {
                    if (text.includes('mencari pekerjaan')) return tracer.status_pekerjaan === 'belum_bekerja' ? 'Ya' : '';
                    if (text.includes('melamar pekerjaan')) return tracer.kapan_mulai_cari_kerja || '';
                    if (text.includes('wawancara kerja')) return tracer.status_kerja_detail || '';
                    if (text.includes('kendala utama')) return tracer.lama_mencari_kerja || '';
                    if (text.includes('rencana anda')) return tracer.saran || '';
                  }
                  if (q.kategori === 'penilaian_prodi') {
                    if (text.includes('kurikulum')) return tracer.eval_kurikulum || '';
                    if (text.includes('dosen')) return tracer.eval_dosen || '';
                    if (text.includes('fasilitas')) return tracer.eval_fasilitas || '';
                    if (text.includes('pelayanan') || text.includes('administrasi')) return tracer.eval_pelayanan || '';
                    if (text.includes('mbkm') || text.includes('magang')) return tracer.eval_mbkm || '';
                  }
                  return '';
                };

                questions.forEach(q => {
                  q.jawaban = jawabanKustomObj[q.id] !== undefined ? jawabanKustomObj[q.id] : getLegacyAnswer(tracerTerbaru, q);
                });

                const isSubmitted = alreadySubmittedForPeriod || Boolean(tracerTerbaru && !canSubmit);

                res.render('alumni/tracer', {
                  title           : 'Form Tracer Study',
                  currentPage     : 'tracer',
                  alumni,
                  tracer          : tracerTerbaru,
                  riwayatList,
                  pengisianKe,
                  periodeSaatIni  : activePeriod ? activePeriod.nama : 'Ditutup',
                  activePeriod,
                  isPeriodOpen,
                  periodOpenMessage,
                  alreadySubmittedForPeriod,
                  periodSubmitMessage,
                  coolDownOk,
                  coolDownMessage,
                  canSubmit,
                  isSubmitted,
                  bekerjaQuestions: questions.filter(q => q.kategori === 'bekerja'),
                  wirausahaQuestions: questions.filter(q => q.kategori === 'wirausaha'),
                  kuliahQuestions: questions.filter(q => q.kategori === 'kuliah'),
                  belumBekerjaQuestions: questions.filter(q => q.kategori === 'belum_bekerja'),
                  penilaianQuestions: questions.filter(q => q.kategori === 'penilaian_prodi'),
                });
              }
            );
          }
        );
      });
    });
  });
};

/* ── POST /alumni/tracer ── */
exports.submitForm = (req, res) => {
  const alumniId = req.session.alumniId;
  const { status_pekerjaan, saran } = req.body;
  const now = new Date();

  if (!status_pekerjaan) {
    req.session.flash_error = 'Status pekerjaan wajib dipilih.';
    return res.redirect('/alumni/tracer');
  }

  // ── PROFILE CHECK (Warning only, do not block tracer submit) ──
  db.query('SELECT * FROM alumni WHERE id = ?', [alumniId], (errA, aRows) => {
    if (errA || aRows.length === 0) {
      req.session.flash_error = 'Terjadi kesalahan server saat memverifikasi akun alumni.';
      return res.redirect('/alumni/tracer');
    }
    const alumniCheck = aRows[0];

    // Check active period created by admin strictly
    db.query('SELECT * FROM tracer_periode WHERE is_active = 1 ORDER BY id DESC LIMIT 1', [], (errPeriode, periodRows) => {
      if (errPeriode) return res.status(500).send('DB error');

      const activePeriod = periodRows.length > 0 ? periodRows[0] : null;
      if (!activePeriod) {
        req.session.flash_error = 'Pengisian kuesioner tidak dapat dikirim karena jadwal pengisian belum dibuka oleh Admin.';
        return res.redirect('/alumni/tracer');
      }

      const start = new Date(activePeriod.tanggal_mulai);
      const end = new Date(activePeriod.tanggal_selesai);
      if (now < start || now > end) {
        req.session.flash_error = `Pengisian kuesioner ditutup. Jadwal pengisian untuk periode '${activePeriod.nama}' adalah tanggal ${start.toLocaleDateString('id-ID')} s/d ${end.toLocaleDateString('id-ID')}.`;
        return res.redirect('/alumni/tracer');
      }

    // Check if already submitted for active period
    db.query(
      'SELECT id FROM tracer_study WHERE alumni_id = ? AND periode = ? LIMIT 1',
      [alumniId, activePeriod.nama],
      (errPeriodCheck, periodCheckRows) => {
        if (errPeriodCheck) return res.status(500).send('DB error checking period submission');

        if (periodCheckRows.length > 0) {
          req.session.flash_error = `Gagal menyimpan. Anda sudah mengisi kuesioner Tracer Study untuk periode '${activePeriod.nama}'.`;
          return res.redirect('/alumni/tracer');
        }

        // Fetch all questions from database to perform validation and mapping to legacy columns
        db.query('SELECT * FROM kuesioner_pertanyaan', [], (errQ, questions) => {
          if (errQ) return res.status(500).send('DB error');

            const qMap = {};
            (questions || []).forEach(q => {
              qMap[q.id] = q;
            });

            // Collect dynamic answers from req.body
            const jawaban_kustom_obj = {};
            for (const key in req.body) {
              if (key.startsWith('pertanyaan_')) {
                const qId = key.replace('pertanyaan_', '');
                jawaban_kustom_obj[qId] = req.body[key];
              }
            }

            // Constraints passed, compute pengisian_ke
            db.query(
              'SELECT COUNT(*) AS total FROM tracer_study WHERE alumni_id = ?',
              [alumniId],
              (errCount, countRows) => {
                if (errCount) return res.status(500).send('DB error');

                const pengisianKe = (countRows[0].total || 0) + 1;

                const fields = {
                  alumni_id              : alumniId,
                  periode                : activePeriod.nama,
                  pengisian_ke           : pengisianKe,
                  status_pekerjaan,
                  jawaban_kustom         : JSON.stringify(jawaban_kustom_obj),
                  
                  // Initialize legacy fields to null (or fallback defaults)
                  nama_perusahaan        : null,
                  jabatan                : null,
                  bidang_perusahaan      : null,
                  lokasi_perusahaan      : null,
                  gaji_pertama           : null,
                  lama_mencari_kerja     : null,
                  media_mencari_kerja    : null,
                  kesesuaian_bidang      : null,
                  nama_universitas       : null,
                  program_studi_lanjut   : null,
                  jenjang_lanjut         : null,
                  kompetensi_relevan     : 'relevan',
                  kepuasan_layanan       : 4,
                  saran                  : saran || null,
                  status_kerja_detail    : null,
                  kepuasan_kurikulum     : null,
                  eval_kurikulum         : null,
                  eval_dosen             : null,
                  eval_fasilitas         : null,
                  eval_pelayanan         : null,
                  eval_mbkm              : null,
                  
                  // New bekerja fields
                  kapan_mulai_cari_kerja : null,
                  jenis_instansi         : null,
                  penghasilan_bulanan    : null,
                  kesesuaian_kompetensi  : null,
                  pendidikan_minimal_s1  : null,
                };

                // Map dynamic answers to legacy columns where applicable
                for (const qId in jawaban_kustom_obj) {
                  const q = qMap[qId];
                  if (!q) continue;

                  const val = jawaban_kustom_obj[qId];
                  if (!val) continue;

                  const text = (q.pertanyaan || '').toLowerCase();

                  if (q.kategori === 'bekerja') {
                    if (text.includes('saat ini sudah bekerja')) fields.status_kerja_detail = val;
                    else if (text.includes('kapan anda mulai mencari')) fields.kapan_mulai_cari_kerja = val;
                    else if (text.includes('berapa lama') || text.includes('waktu yang dibutuhkan')) fields.lama_mencari_kerja = val;
                    else if (text.includes('nama instansi') || text.includes('nama perusahaan')) fields.nama_perusahaan = val;
                    else if (text.includes('jenis instansi')) fields.jenis_instansi = val;
                    else if (text.includes('bidang usaha')) fields.bidang_perusahaan = val;
                    else if (text.includes('jabatan')) fields.jabatan = val;
                    else if (text.includes('lokasi')) fields.lokasi_perusahaan = val;
                    else if (text.includes('status kepegawaian') || text.includes('status pekerjaan')) fields.status_kerja_detail = val;
                    else if (text.includes('penghasilan pertama') || text.includes('gaji pertama')) fields.gaji_pertama = val;
                    else if (text.includes('penghasilan anda saat ini') || text.includes('gaji saat ini')) fields.penghasilan_bulanan = val;
                    else if (text.includes('sesuai dengan bidang studi') || text.includes('kesesuaian bidang')) fields.kesesuaian_bidang = val;
                    else if (text.includes('kompetensi yang diperoleh') || text.includes('kesesuaian pekerjaan')) fields.kesesuaian_kompetensi = parseInt(val) || null;
                  }
                  else if (q.kategori === 'wirausaha') {
                    if (text.includes('nama usaha')) fields.nama_perusahaan = val;
                    else if (text.includes('bidang usaha')) fields.bidang_perusahaan = val;
                    else if (text.includes('tahun memulai')) fields.kapan_mulai_cari_kerja = val;
                    else if (text.includes('jumlah karyawan')) fields.jabatan = val;
                    else if (text.includes('omzet')) {
                      fields.gaji_pertama = val;
                      fields.penghasilan_bulanan = val;
                    }
                    else if (text.includes('sumber modal')) fields.media_mencari_kerja = val;
                    else if (text.includes('sesuai dengan bidang studi') || text.includes('kesesuaian')) fields.kesesuaian_bidang = val;
                    else if (text.includes('perkuliahan membantu')) fields.kesesuaian_kompetensi = parseInt(val) || null;
                  }
                  else if (q.kategori === 'kuliah') {
                    if (text.includes('perguruan tinggi') || text.includes('universitas')) fields.nama_universitas = val;
                    else if (text.includes('jenjang')) fields.jenjang_lanjut = val;
                    else if (text.includes('program studi')) fields.program_studi_lanjut = val;
                    else if (text.includes('tahun masuk')) fields.kapan_mulai_cari_kerja = val;
                    else if (text.includes('alasan')) fields.saran = val;
                    else if (text.includes('sumber pembiayaan')) fields.media_mencari_kerja = val;
                  }
                  else if (q.kategori === 'belum_bekerja') {
                    if (text.includes('melamar pekerjaan')) fields.kapan_mulai_cari_kerja = val;
                    else if (text.includes('wawancara kerja')) fields.status_kerja_detail = val;
                    else if (text.includes('kendala')) fields.lama_mencari_kerja = val;
                    else if (text.includes('rencana anda')) fields.saran = val;
                  }
                  else if (q.kategori === 'penilaian_prodi') {
                    if (text.includes('kurikulum')) fields.eval_kurikulum = parseInt(val) || fields.eval_kurikulum;
                    else if (text.includes('dosen')) fields.eval_dosen = parseInt(val) || fields.eval_dosen;
                    else if (text.includes('fasilitas') || text.includes('laboratorium') || text.includes('kelas')) fields.eval_fasilitas = parseInt(val) || fields.eval_fasilitas;
                    else if (text.includes('pelayanan') || text.includes('administrasi') || text.includes('sistem akademik')) fields.eval_pelayanan = parseInt(val) || fields.eval_pelayanan;
                    else if (text.includes('mbkm') || text.includes('magang')) fields.eval_mbkm = parseInt(val) || fields.eval_mbkm;
                  }
                }

                db.query(
                  'INSERT INTO tracer_study SET ?',
                  [fields],
                  (e) => {
                    if (e) {
                      console.error('Error inserting tracer study:', e);
                      req.session.flash_error = 'Gagal menyimpan data.';
                    } else {
                      db.query(
                        "UPDATE alumni SET status_pengisian = 'sudah' WHERE id = ?",
                        [alumniId],
                        () => {}
                      );
                      req.session.flash_success = `Data tracer study periode '${activePeriod.nama}' berhasil disimpan! (Pengisian ke-${pengisianKe})`;
                    }
                    res.redirect('/alumni/tracer');
                  }
                );
              }
            );
          });
        });
      });
    });
};
