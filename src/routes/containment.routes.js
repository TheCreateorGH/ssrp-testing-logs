const { Router } = require('express');
const ctrl = require('../controllers/containment.controller');

const router = Router();

router.get('/', ctrl.list);
router.put('/:scp', ctrl.setStatus);

module.exports = router;
