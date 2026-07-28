const express = require('express');
const router  = express.Router();
const ctrl    = require('../../controllers/admin/lowonganAdminController');
const { isAdminLoggedIn } = require('../../middleware/authMiddleware');
const multer  = require('multer');
const path    = require('path');

// Storage configuration for vacancy posters
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../public/images'));
  },
  filename: (req, file, cb) => {
    cb(null, 'loker_' + Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ 
  storage,
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB max
});

router.use(isAdminLoggedIn);

router.get('/',             ctrl.index);
router.get('/akses',        ctrl.listAccess);
router.get('/tambah',       ctrl.showTambah);
router.post('/tambah',      upload.single('gambar'), ctrl.store);
router.get('/:id/edit',     ctrl.showEdit);
router.post('/:id/edit',    upload.single('gambar'), ctrl.update);
router.post('/:id/hapus',   ctrl.destroy);
router.post('/:id/toggle',  ctrl.toggleStatus);

module.exports = router;

