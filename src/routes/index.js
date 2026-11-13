const { Router } = require('express');

const authRoutes = require('./auth.routes');
const adminRoutes = require('./admin.routes');
const permissionRoutes = require('./permission.routes');
const logsRoutes = require('./logs.routes');
const eventsRoutes = require('./events.routes');
const scpsRoutes = require('./scps.routes');
const settingsRoutes = require('./settings.routes');
const importRoutes = require('./import.routes');
const streamRoutes = require('./stream.routes');
const scheduleRoutes = require('./schedule.routes');
const crossTestRoutes = require('./crosstest.routes');
const logSessionRoutes = require('./logsession.routes');
const containmentRoutes = require('./containment.routes');
const controlRoutes = require('./control.routes');
const { verifyIdentity, requirePermission } = require('../middleware/permission.middleware');

const router = Router();

router.use('/auth', authRoutes);

// Every route below re-validates identity + status against the
// persistent user store on every single request (verifyIdentity),
// then (where applicable) checks a granular per-action permission.
router.use('/admin/users', verifyIdentity, requirePermission('ADMIN:USERS'), adminRoutes);
router.use('/admin/permissions', verifyIdentity, permissionRoutes);

router.use('/logs', verifyIdentity, logsRoutes);
router.use('/events', verifyIdentity, eventsRoutes);
router.use('/scps', verifyIdentity, scpsRoutes);
router.use('/settings', verifyIdentity, settingsRoutes);
router.use('/import', verifyIdentity, importRoutes);
router.use('/stream', verifyIdentity, streamRoutes);
router.use('/schedules', verifyIdentity, scheduleRoutes);
router.use('/cross-test', verifyIdentity, crossTestRoutes);
router.use('/log-sessions', verifyIdentity, logSessionRoutes);
router.use('/containment', verifyIdentity, containmentRoutes);
// Control actions use the same identity refresh as the web console, so a
// deleted or suspended account cannot keep using a permanent device token.
router.use('/control', verifyIdentity, controlRoutes);

module.exports = router;
