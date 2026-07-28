const express = require('express');
const router = express.Router();
const { getBerandaPage } = require('../controllers/berandaController');

router.get('/', getBerandaPage);
router.get('/beranda', getBerandaPage);

module.exports = router;