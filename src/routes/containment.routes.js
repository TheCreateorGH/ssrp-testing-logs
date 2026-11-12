const { Router } = require('express');
const { requirePermission } = require('../middleware/permission.middleware');
const ctrl = require('../controllers/containment.controller');

const router = Router();

router.get('/', ctrl.list);
router.put('/:scp', requirePermission('MANAGE:CONTAINMENT'), ctrl.setStatus);

module.exports = router;
