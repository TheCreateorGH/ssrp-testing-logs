const { v4: uuidv4 } = require('uuid');
const { readAllEvents, saveEvent, deleteEventFile } = require('../services/event.service');
const permissionService = require('../services/permission.service');
const { getActiveSessionId } = require('../services/logsession.service');
const hub = require('../realtime/hub');

/** Facility-event type -> the granular action required to log it.
 *  Event types with no entry here (e.g. plain manual entries, if ever
 *  posted through this endpoint) are allowed for any authenticated user. */
const TYPE_TO_ACTION = {
    BREACH: 'MANAGE:BREACH',
    BREACH_END: 'MANAGE:BREACH_END',
    CDC_RIOT: 'MANAGE:CDC_RIOT',
    ALARM: 'MANAGE:ALARM',
    THREAT: 'MANAGE:THREAT',
    CDC: 'MANAGE:CDC',
    BROADCAST: 'MANAGE:BROADCAST',
    WARHEAD: 'MANAGE:WARHEADS'
};

async function listEvents(req, res) {
    res.json(await readAllEvents());
}

async function createEvent(req, res) {
    const type = req.body.type;
    const action = TYPE_TO_ACTION[type];
    if (action) {
        console.debug(`[PERM] checking "${action}" for ${req.user.username} (event type ${type})`);
        const allowed = await permissionService.hasPermission(req.user.id, req.user.roleCode, action);
        if (!allowed) {
            console.warn(`[PERM] DENIED "${action}" for ${req.user.username} (${req.user.roleCode})`);
            return res.status(403).json({ error: `Missing permission: ${action}` });
        }
    }
    const id = uuidv4();
    const now = new Date().toISOString();
    const sessionId = req.body.sessionId || await getActiveSessionId();
    const event = { ...req.body, id, createdAt: now, updatedAt: now, sessionId, loggedBy: req.session.name, loggedByRole: req.session.roleCode };
    await saveEvent(event);
    hub.broadcast('event:created', event, req.headers['x-client-id']);
    res.status(201).json(event);
}

async function removeEvent(req, res) {
    if (!await deleteEventFile(req.params.id)) {
        return res.status(404).json({ error: 'Not found' });
    }
    hub.broadcast('event:deleted', { id: req.params.id }, req.headers['x-client-id']);
    res.json({ deleted: true });
}

module.exports = { listEvents, createEvent, removeEvent };
