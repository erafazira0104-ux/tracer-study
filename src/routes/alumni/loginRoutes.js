const express = require('express');
const router  = express.Router();
const ctrl    = require('../../controllers/alumni/loginController');
const { redirectIfAlumniLoggedIn } = require('../../middleware/authMiddleware');

// GET  /login
router.get('/',  redirectIfAlumniLoggedIn, ctrl.showLogin);

// POST /login
router.post('/', ctrl.handleLogin);

// POST /logout
router.post('/logout', ctrl.handleLogout);

module.exports = router;
