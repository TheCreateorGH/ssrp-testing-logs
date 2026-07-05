const { Router } = require('express');
const { importLog } = require('../controllers/import.controller');

const router = Router();

router.post('/', importLog);

module.exports = router;
