const { Router } = require('express');
const { asyncHandler } = require('../middleware/asyncHandler');
const { getSettings } = require('../controllers/settings.controller');

const router = Router();

router.get('/', asyncHandler(getSettings));

module.exports = router;
