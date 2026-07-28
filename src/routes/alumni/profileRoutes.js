const express = require('express');
const router  = express.Router();
const ctrl    = require('../../controllers/alumni/profileController');
const { isAlumniLoggedIn } = require('../../middleware/authMiddleware');

router.use(isAlumniLoggedIn);

// GET /alumni/profile
router.get('/', ctrl.showProfile);

// POST /alumni/profile/change-password
router.post('/change-password', ctrl.changePassword);

// POST /alumni/profile
router.post('/', ctrl.updateProfile);

module.exports = router;
