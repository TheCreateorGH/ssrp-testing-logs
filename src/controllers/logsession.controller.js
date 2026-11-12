const logSessionService = require('../services/logsession.service');
const { saveEvent } = require('../services/event.service');
const { v4: uuidv4 } = require('uuid');
const hub = require('../realtime/hub');

async function list(req, res) {
    res.json(await logSessionService.listSessions());
}

async function create(req, res) {
    const session = await logSessionService.createSession(req.session.name);

    // "Alarm, Threat, etc. get reset to default values" — logged as real
    // audit events (tagged to the new session) rather than a silent
    // client-side reset, so the reset itself is part of the record.
    const now = new Date().toISOString();
    const resets = [
        { type: 'ALARM', status: "Set Alarm to 'None'" },
        { type: 'THREAT', status: "Set Threat to 'Low'" },
        { type: 'CDC', status: 'Off' }
    ];
    for (const r of resets) {
        const event = {
            id: uuidv4(), scp: 'SITE', type: r.type,
            researcherName: 'SESSION-CONTROL', researcherRank: 'AUTO-RESET',
            status: r.status, sessionId: session.id,
            createdAt: now, updatedAt: now
        };
        await saveEvent(event);
        hub.broadcast('event:created', event, req.headers['x-client-id']);
    }

    hub.broadcast('logsession:created', session, req.headers['x-client-id']);
    res.status(201).json(session);
}

module.exports = { list, create };
