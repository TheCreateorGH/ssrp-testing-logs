const { v4: uuidv4 } = require('uuid');
const { readAllEvents, saveEvent, deleteEventFile } = require('../services/event.service');
const { canPerform } = require('../config/roles');
const hub = require('../realtime/hub');

async function listEvents(req, res) {
    res.json(await readAllEvents());
}

async function createEvent(req, res) {
    const type = req.body.type;
    if (!canPerform(type, req.session.roleCode)) {
        return res.status(403).json({ error: `${req.session.roleName} (${req.session.roleCode}) is not authorized to log a ${type} event.` });
    }
    const id = uuidv4();
    const now = new Date().toISOString();
    const event = { ...req.body, id, createdAt: now, updatedAt: now, loggedBy: req.session.name, loggedByRole: req.session.roleCode };
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
