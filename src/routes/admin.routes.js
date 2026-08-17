const { Router } = require('express');
const ctrl = require('../controllers/admin.controller');
const { requireAdmin } = require('../middleware/auth.middleware');

const router = Router();

router.use(requireAdmin);
router.get('/users', ctrl.listUsers);
router.put('/users/:id', ctrl.updateUser);
router.post('/users/:id/reset-password', ctrl.resetPassword);
router.delete('/users/:id', ctrl.deleteUser);

module.exports = router;
