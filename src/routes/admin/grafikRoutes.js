const express = require('express');
const router  = express.Router();
const ctrl    = require('../../controllers/admin/grafikController');
const { isAdminLoggedIn } = require('../../middleware/authMiddleware');

router.use(isAdminLoggedIn);
router.get('/', ctrl.index);

module.exports = router;
