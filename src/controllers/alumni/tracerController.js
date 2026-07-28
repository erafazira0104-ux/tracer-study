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

  // Get active period
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

        // Fetch ALL tracer study entries for this alumni, ordered by newest first
        db.query(
          'SELECT * FROM tracer_study WHERE alumni_id = ? ORDER BY tanggal_isi DESC',
          [alumniId],
          (err, rows) => {
            if (err) return res.status(500).send('DB error');

            const riwayatList = rows || [];
            const tracerTerbaru = riwayatList.length > 0 ? riwayatList[0] : null;
            const pengisianKe = riwayatList.length + 1;

            // Check if active period window is open
            const now = new Date();
            let isPeriodOpen = false;
            let periodOpenMessage = 'Masa pengisian kuesioner saat ini sedang ditutup.';
            let namaPeriode = '';

            if (activePeriod) {
              namaPeriode = activePeriod.nama;
              const start = new Date(activePeriod.tanggal_mulai);
              const end = new Date(activePeriod.tanggal_selesai);
              if (now >= start && now <= end) {
                isPeriodOpen = true;
              } else if (now < start) {
                periodOpenMessage = `Masa pengisian untuk periode '${activePeriod.nama}' belum dimulai. (Mulai: ${start.toLocaleString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })})`;
              } else {
                periodOpenMessage = `Masa pengisian untuk periode '${activePeriod.nama}' sudah berakhir pada ${end.toLocaleString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}.`;
              }
            }

            // Check dynamic cooldown rule
            let coolDownOk = true;
            let coolDownMessage = '';
            let nextAvailableDate = null;

            if (tracerTerbaru) {
              const lastDate = new Date(tracerTerbaru.tanggal_isi);
              const cooldownMs = cooldownBulan * 30.44 * 24 * 60 * 60 * 1000;
              nextAvailableDate = new Date(lastDate.getTime() + cooldownMs);
              if (now < nextAvailableDate) {
                coolDownOk = false;
                coolDownMessage = `Anda baru saja mengisi kuesioner pada ${lastDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}. Berdasarkan ketentuan yang diatur oleh Admin, pengisian berkala hanya dapat dilakukan minimal ${cooldownBulan} bulan sekali. Anda dapat mengisi kembali setelah tanggal ${nextAvailableDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}.`;
              }
            }

            const canSubmit = isPeriodOpen && coolDownOk;

            const error   = req.session.flash_error   || null;
            const success = req.session.flash_success  || null;
            delete req.session.flash_error;
            delete req.session.flash_success;

            // Fetch dynamic Penilaian Program Studi questions
            db.query(
              'SELECT * FROM kuesioner_pertanyaan WHERE kategori = ? AND is_active = 1 ORDER BY urutan ASC, id ASC',
              ['penilaian_prodi'],
              (errPenilaian, rowsPenilaian) => {
                res.render('alumni/tracer', {
                  title           : 'Form Tracer Study',
                  currentPage     : 'tracer',
                  alumni,
                  tracer          : tracerTerbaru,
                  riwayatList,
                  pengisianKe,
                  periodeSaatIni  : activePeriod ? activePeriod.nama : new Date().getFullYear().toString(),
                  activePeriod,
                  isPeriodOpen,
                  periodOpenMessage,
                  coolDownOk,
                  coolDownMessage,
                  canSubmit,
                  penilaianQuestions: rowsPenilaian || [],
                  error,
                  success,
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
  const {
    status_pekerjaan,
    nama_perusahaan, jabatan, bidang_perusahaan, lokasi_perusahaan,
    gaji_pertama, lama_mencari_kerja, media_mencari_kerja, kesesuaian_bidang,
    nama_universitas, program_studi_lanjut, jenjang_lanjut,
    kompetensi_relevan, kepuasan_layanan, saran,
    status_kerja_detail, kepuasan_kurikulum,
    eval_kurikulum, eval_dosen, eval_fasilitas, eval_pelayanan, eval_mbkm,
    // New bekerja fields
    kapan_mulai_cari_kerja, jenis_instansi, penghasilan_bulanan,
    kesesuaian_kompetensi, pendidikan_minimal_s1
  } = req.body;

  if (!status_pekerjaan) {
    req.session.flash_error = 'Status pekerjaan wajib dipilih.';
    return res.redirect('/alumni/tracer');
  }

  // Double check constraints on submission
  db.query('SELECT * FROM tracer_periode WHERE is_active = 1 LIMIT 1', [], (errPeriode, periodRows) => {
    if (errPeriode) return res.status(500).send('DB error');
    const activePeriod = periodRows.length > 0 ? periodRows[0] : null;

    if (!activePeriod) {
      req.session.flash_error = 'Gagal menyimpan. Tidak ada periode tracer study aktif saat ini.';
      return res.redirect('/alumni/tracer');
    }

    const now = new Date();
    const start = new Date(activePeriod.tanggal_mulai);
    const end = new Date(activePeriod.tanggal_selesai);

    if (now < start || now > end) {
      req.session.flash_error = 'Gagal menyimpan. Masa pengisian periode aktif telah berakhir atau belum dimulai.';
      return res.redirect('/alumni/tracer');
    }

    // Get dynamic cooldown setting
    db.query("SELECT nilai FROM tracer_pengaturan WHERE kunci = 'cooldown_bulan' LIMIT 1", [], (errSetting, settingRows) => {
      if (errSetting) return res.status(500).send('DB error');
      const cooldownBulan = parseInt(settingRows.length > 0 ? settingRows[0].nilai : '3');

      // Check cooldown
      db.query(
        'SELECT * FROM tracer_study WHERE alumni_id = ? ORDER BY tanggal_isi DESC LIMIT 1',
        [alumniId],
        (errLast, lastRows) => {
          if (errLast) return res.status(500).send('DB error');

          if (lastRows.length > 0) {
            const lastDate = new Date(lastRows[0].tanggal_isi);
            const cooldownMs = cooldownBulan * 30.44 * 24 * 60 * 60 * 1000;
            const nextAvailableDate = new Date(lastDate.getTime() + cooldownMs);
            if (now < nextAvailableDate) {
              req.session.flash_error = `Gagal menyimpan. Berdasarkan pengaturan Admin, Anda hanya dapat mengisi tracer study ${cooldownBulan} bulan sekali.`;
              return res.redirect('/alumni/tracer');
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
                nama_perusahaan        : nama_perusahaan || null,
                jabatan                : jabatan || null,
                bidang_perusahaan      : bidang_perusahaan || null,
                lokasi_perusahaan      : lokasi_perusahaan || null,
                gaji_pertama           : gaji_pertama || null,
                lama_mencari_kerja     : lama_mencari_kerja || null,
                media_mencari_kerja    : media_mencari_kerja || null,
                kesesuaian_bidang      : kesesuaian_bidang || null,
                nama_universitas       : nama_universitas || null,
                program_studi_lanjut   : program_studi_lanjut || null,
                jenjang_lanjut         : jenjang_lanjut || null,
                kompetensi_relevan     : kompetensi_relevan || null,
                kepuasan_layanan       : kepuasan_layanan ? parseInt(kepuasan_layanan) : null,
                saran                  : saran || null,
                status_kerja_detail    : status_kerja_detail || null,
                kepuasan_kurikulum     : kepuasan_kurikulum || null,
                eval_kurikulum         : eval_kurikulum ? parseInt(eval_kurikulum) : null,
                eval_dosen             : eval_dosen ? parseInt(eval_dosen) : null,
                eval_fasilitas         : eval_fasilitas ? parseInt(eval_fasilitas) : null,
                eval_pelayanan         : eval_pelayanan ? parseInt(eval_pelayanan) : null,
                eval_mbkm              : eval_mbkm ? parseInt(eval_mbkm) : null,
                // New bekerja fields
                kapan_mulai_cari_kerja : kapan_mulai_cari_kerja || null,
                jenis_instansi         : jenis_instansi || null,
                penghasilan_bulanan    : penghasilan_bulanan || null,
                kesesuaian_kompetensi  : kesesuaian_kompetensi ? parseInt(kesesuaian_kompetensi) : null,
                pendidikan_minimal_s1  : pendidikan_minimal_s1 || null,
              };

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
        }
      );
    });
  });
};
