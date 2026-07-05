const { Router } = require('express');
const { stream } = require('../controllers/stream.controller');

const router = Router();

router.get('/', stream);

module.exports = router;
