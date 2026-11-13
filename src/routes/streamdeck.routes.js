const { Router } = require('express');
const { asyncHandler } = require('../middleware/asyncHandler');
const { requireStreamDeckToken } = require('../middleware/streamdeck.middleware');
const ctrl = require('../controllers/streamdeck.controller');

const router = Router();

router.use(requireStreamDeckToken);
router.get('/', asyncHandler(ctrl.snapshot));
router.post('/alarm/:value', asyncHandler(ctrl.alarm));
router.post('/threat/:value', asyncHandler(ctrl.threat));
router.post('/cdc/:value', asyncHandler(ctrl.cdc));
router.post('/warhead/:action', asyncHandler(ctrl.warhead));

module.exports = router;
