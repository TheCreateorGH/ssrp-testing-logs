const { Router } = require('express');
const ctrl = require('../controllers/auth.controller');
const { attachSession, requireAuth } = require('../middleware/auth.middleware');

const router = Router();

router.get('/roles', ctrl.listRoles);
router.post('/login', ctrl.login);
router.get('/whoami', attachSession, requireAuth, ctrl.whoami);
router.post('/logout', attachSession, ctrl.logout);

module.exports = router;
