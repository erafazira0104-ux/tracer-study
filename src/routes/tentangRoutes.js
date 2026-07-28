const express = require('express');
const router = express.Router();
const { getTentangPage } = require('../controllers/tentangController');

router.get('/', getTentangPage);

module.exports = router;