const { Router } = require('express');
const ctrl = require('../controllers/logsession.controller');

const router = Router();

router.get('/', ctrl.list);
router.post('/', ctrl.create);

module.exports = router;
