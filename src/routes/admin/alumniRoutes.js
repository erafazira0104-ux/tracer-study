const express = require('express');
const router  = express.Router();
const ctrl    = require('../../controllers/admin/alumniController');
const { isAdminLoggedIn } = require('../../middleware/authMiddleware');
const multer  = require('multer');
const upload  = multer({ storage: multer.memoryStorage() });

router.use(isAdminLoggedIn);

router.get('/',                ctrl.index);
router.get('/export',          ctrl.exportCsv);
router.get('/export-pdf',      ctrl.exportPdf);
router.get('/tambah',          ctrl.showTambah);
router.post('/tambah',         ctrl.store);
router.get('/:id/detail',      ctrl.getDetail);
router.get('/:id/edit',        ctrl.showEdit);
router.post('/:id/edit',       ctrl.update);
router.post('/:id/hapus',      ctrl.destroy);
router.post('/:id/toggle',     ctrl.toggleStatus);
router.post('/:id/reset-password', ctrl.resetPassword);

module.exports = router;

