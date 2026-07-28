const express = require('express');
const router = express.Router();
const { getKonseling, getBookKonselor, getMulaiKonseling } = require('../controllers/konselingController');

router.get('/', getKonseling);
router.get('/mulai', getMulaiKonseling);
router.get('/book/:id', getBookKonselor);

module.exports = router;