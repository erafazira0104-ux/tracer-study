const express = require('express');
const router  = express.Router();
const ctrl    = require('../../controllers/admin/tracerController');
const { isAdminLoggedIn } = require('../../middleware/authMiddleware');

router.use(isAdminLoggedIn);

// Halaman utama: manajemen kategori kuesioner
router.get('/',       ctrl.index);

// Export CSV
router.get('/export', ctrl.exportCsv);

// Data jawaban alumni (list lengkap)
router.get('/data', ctrl.dataList);

// CRUD Pertanyaan Kuesioner
router.post('/pertanyaan',                ctrl.tambahPertanyaan);
router.post('/pertanyaan/:id',            ctrl.updatePertanyaan);
router.post('/pertanyaan/:id/toggle',     ctrl.toggleAktif);
router.post('/pertanyaan/:id/hapus',      ctrl.hapusPertanyaan);

// Tambah Kategori Baru
router.post('/kategori/tambah', ctrl.tambahKategori);
router.post('/kategori/:id/edit', ctrl.editKategori);

// Hapus Kategori
router.post('/kategori/:id/hapus', ctrl.hapusKategori);

// Detail tracer alumni (untuk link dari dashboard)
router.get('/detail/:id', ctrl.show);

// Kelola Periode Pengisian (Masa Pengisian)
router.get('/periode', ctrl.listPeriode);
router.post('/periode/tambah', ctrl.tambahPeriode);
router.post('/periode/:id/edit', ctrl.editPeriode);
router.post('/periode/:id/toggle', ctrl.togglePeriode);
router.post('/periode/:id/hapus', ctrl.hapusPeriode);

// Update Pengaturan Cooldown Pengisian
router.post('/pengaturan/cooldown', ctrl.updateCooldown);

// Kelola pertanyaan per kategori (dynamic parameter handler)
router.get('/:kategori', (req, res, next) => {
  const k = req.params.kategori;
  // Jika parameter berupa angka, arahkan ke detail tracer study alumni
  if (/^\d+$/.test(k)) {
    return ctrl.show(req, res);
  }
  return ctrl.kelolaKategori(req, res);
});

module.exports = router;
