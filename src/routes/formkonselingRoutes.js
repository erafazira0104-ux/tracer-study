const express = require('express');
const router = express.Router();
const { getFormKonseling, postFormKonseling } = require('../controllers/formkonselingController');

router.get('/', getFormKonseling);
router.post('/', postFormKonseling);

module.exports = router;