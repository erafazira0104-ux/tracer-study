const express = require('express');
const router = express.Router();
const { getRiwayatKonseling } = require('../controllers/riwayatkonselingController');

router.get('/', getRiwayatKonseling);

module.exports = router;