const { Router } = require('express');
const { asyncHandler } = require('../middleware/asyncHandler');
const ctrl = require('../controllers/events.controller');

const router = Router();

router.get('/', asyncHandler(ctrl.listEvents));
router.post('/', asyncHandler(ctrl.createEvent));
router.delete('/:id', asyncHandler(ctrl.removeEvent));

module.exports = router;
