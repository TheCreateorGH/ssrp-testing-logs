const { Router } = require('express');
const ctrl = require('../controllers/admin.controller');

const router = Router();

// Mounted at /api/admin/users — requirePermission('ADMIN:USERS') is
// applied at the mount point in routes/index.js.
router.get('/', ctrl.listUsers);
router.put('/:id', ctrl.updateUser);
router.post('/:id/reset-password', ctrl.resetPassword);
router.delete('/:id', ctrl.deleteUser);

module.exports = router;
