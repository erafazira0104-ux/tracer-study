const express = require('express');
const router  = express.Router();
const ctrl    = require('../../controllers/admin/dashboardController');
const { isAdminLoggedIn } = require('../../middleware/authMiddleware');

router.get('/', isAdminLoggedIn, ctrl.showDashboard);

module.exports = router;
