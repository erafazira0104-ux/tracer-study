const express = require('express');
const router = express.Router();
const { getLowonganPage, logJobAccess } = require('../controllers/lowonganController');

router.get('/', getLowonganPage);
router.post('/akses', logJobAccess);

module.exports = router;