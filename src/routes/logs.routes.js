const { Router } = require('express');
const { asyncHandler } = require('../middleware/asyncHandler');
const { requirePermission } = require('../middleware/permission.middleware');
const ctrl = require('../controllers/logs.controller');

const router = Router();

router.get('/', requirePermission('VIEW:TEST'), asyncHandler(ctrl.listLogs));
router.get('/:id/export', requirePermission('EXPORT:TEST'), asyncHandler(ctrl.exportLog));
router.get('/:id', requirePermission('VIEW:TEST'), asyncHandler(ctrl.getLogById));
router.post('/', requirePermission('CREATE:TEST'), asyncHandler(ctrl.createLog));
router.put('/:id', requirePermission('EDIT:TEST'), asyncHandler(ctrl.updateLog));
router.delete('/:id', requirePermission('DELETE:TEST'), asyncHandler(ctrl.removeLog));

module.exports = router;
