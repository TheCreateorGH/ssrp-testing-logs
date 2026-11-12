const { Router } = require('express');
const { requirePermission } = require('../middleware/permission.middleware');
const ctrl = require('../controllers/schedule.controller');

const router = Router();

router.get('/', ctrl.list);
router.post('/', requirePermission('MANAGE:SCHEDULE'), ctrl.create);
router.delete('/:id', requirePermission('MANAGE:SCHEDULE'), ctrl.remove);

module.exports = router;
