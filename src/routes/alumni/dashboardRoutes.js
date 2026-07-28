const express = require('express');
const router  = express.Router();
const ctrl    = require('../../controllers/alumni/dashboardController');
const { isAlumniLoggedIn } = require('../../middleware/authMiddleware');

router.get('/', isAlumniLoggedIn, ctrl.showDashboard);

module.exports = router;
