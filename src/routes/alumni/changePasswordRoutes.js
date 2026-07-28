const express = require('express');
const router  = express.Router();
const ctrl    = require('../../controllers/alumni/profileController');
const { isAlumniLoggedIn } = require('../../middleware/authMiddleware');

router.use(isAlumniLoggedIn);

// GET /alumni/change-password
router.get('/', ctrl.showChangePassword);

// POST /alumni/change-password
router.post('/', ctrl.changePassword);

module.exports = router;
