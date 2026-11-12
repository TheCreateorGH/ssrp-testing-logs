const { Router } = require('express');
const { asyncHandler } = require('../middleware/asyncHandler');
const { requirePermission } = require('../middleware/permission.middleware');
const ctrl = require('../controllers/events.controller');

const router = Router();

router.get('/', requirePermission('VIEW:EVENT'), asyncHandler(ctrl.listEvents));
// createEvent's required action depends on req.body.type (BREACH vs
// WARHEAD vs ALARM etc), so it's checked dynamically inside the
// controller rather than with a single static route-level gate.
router.post('/', asyncHandler(ctrl.createEvent));
router.delete('/:id', requirePermission('DELETE:EVENT'), asyncHandler(ctrl.removeEvent));

module.exports = router;
