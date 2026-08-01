const express = require('express');
const router  = express.Router();
const ctrl    = require('../../controllers/admin/konselingAdminController');
const { isAdminLoggedIn } = require('../../middleware/authMiddleware');
const multer  = require('multer');
const path    = require('path');

// Storage configuration for counselor photos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../public/images'));
  },
  filename: (req, file, cb) => {
    cb(null, 'konselor_' + Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ 
  storage,
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB max
});

router.use(isAdminLoggedIn);

router.get('/',              ctrl.index);
router.get('/booking',       ctrl.listBookings);
router.get('/export',        ctrl.exportCsv);
router.get('/tambah-konselor', ctrl.showTambahKonselor);
router.post('/tambah-konselor', upload.single('foto'), ctrl.storeKonselor);
router.get('/edit/:id',      ctrl.showEditKonselor);
router.post('/edit/:id',     upload.single('foto'), ctrl.updateKonselor);
router.post('/delete/:id',   ctrl.destroyKonselor);
router.post('/template-wa',  ctrl.updateTemplateWa);
router.post('/:id/status',   ctrl.updateStatus);

module.exports = router;

