const { Router } = require('express');
const { requirePermission } = require('../middleware/permission.middleware');
const ctrl = require('../controllers/logsession.controller');

const router = Router();

router.get('/', ctrl.list);
router.post('/', requirePermission('MANAGE:SESSION'), ctrl.create);

module.exports = router;
