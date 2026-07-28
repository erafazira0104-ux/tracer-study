const express  = require('express');
const router   = express.Router();
const ctrl     = require('../../controllers/admin/loginController');
const { redirectIfAdminLoggedIn } = require('../../middleware/authMiddleware');

// GET  /admin/login
router.get('/',  redirectIfAdminLoggedIn, ctrl.showLogin);

// POST /admin/login
router.post('/', ctrl.handleLogin);

// POST /admin/logout
router.post('/logout', ctrl.handleLogout);

module.exports = router;