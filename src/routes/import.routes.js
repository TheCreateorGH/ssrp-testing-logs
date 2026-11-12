const { Router } = require('express');
const { requirePermission } = require('../middleware/permission.middleware');
const { importLog } = require('../controllers/import.controller');

const router = Router();

router.post('/', requirePermission('IMPORT:TEST'), importLog);

module.exports = router;
