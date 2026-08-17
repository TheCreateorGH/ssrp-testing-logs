const { Router } = require('express');

const authRoutes = require('./auth.routes');
const adminRoutes = require('./admin.routes');
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
const { requireAuth } = require('../middleware/auth.middleware');

const router = Router();

router.use('/auth', authRoutes);

router.use('/admin', requireAuth, adminRoutes);
router.use('/logs', requireAuth, logsRoutes);
router.use('/events', requireAuth, eventsRoutes);
router.use('/scps', requireAuth, scpsRoutes);
router.use('/settings', requireAuth, settingsRoutes);
router.use('/import', requireAuth, importRoutes);
router.use('/stream', requireAuth, streamRoutes);
router.use('/schedules', requireAuth, scheduleRoutes);
router.use('/cross-test', requireAuth, crossTestRoutes);
router.use('/log-sessions', requireAuth, logSessionRoutes);
router.use('/containment', requireAuth, containmentRoutes);

module.exports = router;
