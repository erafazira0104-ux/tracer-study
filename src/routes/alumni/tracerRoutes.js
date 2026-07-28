const express = require('express');
const router  = express.Router();
const ctrl    = require('../../controllers/alumni/tracerController');
const { isAlumniLoggedIn } = require('../../middleware/authMiddleware');

router.use(isAlumniLoggedIn);

router.get('/',   ctrl.showForm);
router.post('/',  ctrl.submitForm);

module.exports = router;
