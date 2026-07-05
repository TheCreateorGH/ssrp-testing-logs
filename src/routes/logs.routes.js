const { Router } = require('express');
const { asyncHandler } = require('../middleware/asyncHandler');
const ctrl = require('../controllers/logs.controller');

const router = Router();

router.get('/', asyncHandler(ctrl.listLogs));
router.get('/:id/export', asyncHandler(ctrl.exportLog));
router.get('/:id', asyncHandler(ctrl.getLogById));
router.post('/', asyncHandler(ctrl.createLog));
router.put('/:id', asyncHandler(ctrl.updateLog));
router.delete('/:id', asyncHandler(ctrl.removeLog));

module.exports = router;
