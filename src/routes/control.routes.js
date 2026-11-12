const { Router } = require('express');
const { asyncHandler } = require('../middleware/asyncHandler');
const ctrl = require('../controllers/control.controller');

const router = Router();

router.get('/', asyncHandler(ctrl.snapshot));
router.post('/alarm', asyncHandler(ctrl.alarm));
router.post('/threat', asyncHandler(ctrl.threat));
router.post('/cdc', asyncHandler(ctrl.cdc));
router.post('/incident', asyncHandler(ctrl.incident));
router.post('/warhead', asyncHandler(ctrl.warhead));

module.exports = router;
