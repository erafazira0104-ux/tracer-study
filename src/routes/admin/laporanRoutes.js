const express = require('express');
const router  = express.Router();
const ctrl    = require('../../controllers/admin/laporanController');
const { isAdminLoggedIn } = require('../../middleware/authMiddleware');

router.use(isAdminLoggedIn);

router.get('/',                  ctrl.index);
router.get('/preview',           ctrl.preview);
router.get('/export/tracer',     ctrl.exportTracer);
router.get('/export/konseling',  ctrl.exportKonseling);
router.get('/export/lowongan',   ctrl.exportLowongan);

module.exports = router;
