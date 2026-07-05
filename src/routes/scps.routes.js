const { Router } = require('express');
const { asyncHandler } = require('../middleware/asyncHandler');
const { getScps } = require('../controllers/scps.controller');

const router = Router();

router.get('/', asyncHandler(getScps));

module.exports = router;
