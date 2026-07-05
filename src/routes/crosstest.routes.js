const { Router } = require('express');
const { assess } = require('../controllers/crosstest.controller');

const router = Router();

router.post('/assess', assess);

module.exports = router;
