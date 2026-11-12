const { Router } = require('express');
const ctrl = require('../controllers/auth.controller');
const { verifyIdentity } = require('../middleware/permission.middleware');

const router = Router();

router.get('/roles', ctrl.listRoles);
router.post('/register', ctrl.register);
router.post('/login', ctrl.login);
router.get('/whoami', verifyIdentity, ctrl.whoami);
router.post('/logout', ctrl.logout); // intentionally doesn't require a *valid* session — logging out an already-stale token should still succeed
router.post('/change-password', verifyIdentity, ctrl.changePassword);

module.exports = router;
