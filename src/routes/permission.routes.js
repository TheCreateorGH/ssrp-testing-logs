const { Router } = require('express');
const ctrl = require('../controllers/permission.controller');
const { requirePermission } = require('../middleware/permission.middleware');

const router = Router();

router.use(requirePermission('ADMIN:PERMISSIONS'));
router.get('/catalog', ctrl.getCatalog);
router.get('/roles/:role', ctrl.getRolePermissions);
router.put('/roles/:role', ctrl.setRolePermissions);
router.post('/roles/:role/reset', ctrl.resetRolePermissions);
router.get('/users/:id', ctrl.getUserPermissions);
router.put('/users/:id', ctrl.setUserPermissions);
router.post('/users/:id/reset', ctrl.resetUserPermissions);

module.exports = router;
