const express = require('express');
const router  = express.Router();
const ctrl    = require('../../controllers/admin/pengaturanController');
const { isAdminLoggedIn } = require('../../middleware/authMiddleware');
const multer  = require('multer');
const path    = require('path');

// Storage configuration for admin profile photos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../public/images'));
  },
  filename: (req, file, cb) => {
    cb(null, 'admin_' + Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ 
  storage,
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB max
});

router.use(isAdminLoggedIn);

router.get('/',            ctrl.index);
router.post('/profil',     upload.single('foto'), ctrl.updateProfil);
router.post('/password',   ctrl.updatePassword);

module.exports = router;
