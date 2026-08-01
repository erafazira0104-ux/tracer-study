const express = require('express');
const router  = express.Router();
const ctrl    = require('../../controllers/admin/pengingatController');
const { isAdminLoggedIn } = require('../../middleware/authMiddleware');

router.use(isAdminLoggedIn);

router.get('/',                 ctrl.index);
router.post('/',                ctrl.tambah);
router.post('/:id/hapus',       ctrl.hapus);

module.exports = router;
