const { v4: uuidv4 } = require('uuid');

const { readAllEvents, saveEvent } = require('./event.service');
const { getActiveSessionId } = require('./logsession.service');
const hub = require('../realtime/hub');

const ALARM_LEVELS = ['None', 'Class-D', 'Chaos Insurgency', 'Breach', 'Site Lockdown'];
const THREAT_LEVELS = ['Low', 'Medium', 'High'];
const CDC_STATUSES = ['On', 'Off'];
const WARHEAD_ACTIONS = {
    initialized: 'Warhead activation sequence initialized',
    surface_sealed: 'Surface sealed',
    exploded: 'Warhead detonated',
    autonuke: 'Autonuke sequence initiated'
};
const INCIDENT_PRESETS = {
    containment_breach: { type: 'BREACH', label: 'Containment Breach' },
    cdc_riot: { type: 'CDC_RIOT', label: 'CDC Riot / Civil Unrest' },
    chaos_incursion: { type: 'BREACH', label: 'Chaos Insurgency Incursion' },
    site_lockdown: { type: 'BREACH', label: 'Site-Wide Lockdown' },
    perimeter_breach: { type: 'BREACH', label: 'Perimeter Breach' },
    armed_contact: { type: 'BREACH', label: 'Armed Contact' }
};

function assertOneOf(value, values, field) {
    if (!values.includes(value)) {
        const error = new Error(`${field} must be one of: ${values.join(', ')}.`);
        error.status = 400;
        throw error;
    }
}

function actorFields(session, source) {
    return {
        researcherName: source || 'SITE-CONTROL',
        researcherRank: 'CONTROL-ENDPOINT',
        loggedBy: session.name,
        loggedByRole: session.roleCode
    };
}

async function record(req, fields) {
    const now = new Date().toISOString();
    const event = {
        ...fields,
        id: uuidv4(),
        createdAt: now,
        updatedAt: now,
        sessionId: fields.sessionId || await getActiveSessionId(),
        ...actorFields(req.session, fields.source)
    };
    delete event.source;
    await saveEvent(event);
    await hub.broadcast('event:created', event, req.headers['x-client-id']);
    return event;
}

function getIncidentPreset(key) {
    const preset = INCIDENT_PRESETS[key];
    if (!preset) {
        const error = new Error(`incidentType must be one of: ${Object.keys(INCIDENT_PRESETS).join(', ')}.`);
        error.status = 400;
        throw error;
    }
    return preset;
}

async function listActiveIncidents() {
    const events = await readAllEvents();
    const endings = new Set(
        events.filter(event => event.type === 'BREACH_END' && event.linkedEventId)
            .map(event => event.linkedEventId)
    );
    return events
        .filter(event => (event.type === 'BREACH' || event.type === 'CDC_RIOT') && !endings.has(event.id))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function resolveIncident({ incidentId, incidentType, scp }) {
    if (incidentId) {
        const active = await listActiveIncidents();
        return active.find(event => event.id === incidentId) || null;
    }

    const preset = getIncidentPreset(incidentType || 'containment_breach');
    const active = await listActiveIncidents();
    return active.find(event =>
        event.type === preset.type &&
        (!scp || event.scp === scp) &&
        (!event.incidentType || event.incidentType === incidentType)
    ) || null;
}

async function changeAlarm(req, value) {
    assertOneOf(value, ALARM_LEVELS, 'value');
    return record(req, { type: 'ALARM', scp: 'SITE', status: `Set Alarm to '${value}'`, source: 'SITE-CONTROL' });
}

async function changeThreat(req, value) {
    assertOneOf(value, THREAT_LEVELS, 'value');
    return record(req, { type: 'THREAT', scp: 'SITE', status: `Set Threat to '${value}'`, source: 'SITE-CONTROL' });
}

async function changeCdc(req, value) {
    assertOneOf(value, CDC_STATUSES, 'value');
    return record(req, { type: 'CDC', scp: 'SITE', status: value, source: 'SITE-CONTROL' });
}

async function changeIncident(req, body) {
    const { state = 'breached', incidentType = 'containment_breach', scp, status } = body;
    assertOneOf(state, ['breached', 'contained'], 'state');
    const preset = getIncidentPreset(incidentType);

    if (state === 'contained') {
        const incident = await resolveIncident(body);
        if (!incident) {
            const error = new Error('No matching active incident was found.');
            error.status = 404;
            throw error;
        }
        return record(req, {
            type: 'BREACH_END',
            scp: incident.scp || scp || 'SITE',
            linkedEventId: incident.id,
            incidentType: incident.incidentType || incidentType,
            status: status || `${incident.status || preset.label} — Contained`,
            source: 'SITE-SECURITY'
        });
    }

    if (preset.type === 'BREACH' && !scp) {
        const error = new Error('scp is required for this incident type.');
        error.status = 400;
        throw error;
    }

    return record(req, {
        type: preset.type,
        scp: scp || 'SITE',
        incidentType,
        status: status || preset.label,
        source: 'SITE-SECURITY'
    });
}

async function changeWarhead(req, action) {
    assertOneOf(action, Object.keys(WARHEAD_ACTIONS), 'action');
    return record(req, {
        type: 'WARHEAD',
        scp: 'NUKE',
        status: WARHEAD_ACTIONS[action],
        warheadAction: action,
        source: 'SITE-COMMAND'
    });
}

async function getSnapshot() {
    const events = await readAllEvents();
    const latest = type => events.find(event => event.type === type);
    const extractQuoted = status => {
        const match = status && status.match(/'([^']+)'/);
        return match ? match[1] : null;
    };

    return {
        alarm: extractQuoted(latest('ALARM')?.status) || 'None',
        threat: extractQuoted(latest('THREAT')?.status) || 'Low',
        cdc: latest('CDC')?.status || 'Off',
        activeIncidents: await listActiveIncidents(),
        warheadActions: WARHEAD_ACTIONS,
        incidentTypes: Object.keys(INCIDENT_PRESETS)
    };
}

module.exports = {
    ALARM_LEVELS,
    THREAT_LEVELS,
    CDC_STATUSES,
    WARHEAD_ACTIONS,
    INCIDENT_PRESETS,
    changeAlarm,
    changeThreat,
    changeCdc,
    changeIncident,
    changeWarhead,
    getSnapshot
};
