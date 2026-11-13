const { v4: uuidv4 } = require('uuid');
const path = require('path');

const { LOGS_DIR } = require('../config/paths');
const { readSCPs } = require('../services/scp.service');
const { readAllLogs, readLog, saveLog, deleteLogFile } = require('../services/log.service');
const { normalizeLog } = require('../utils/normalize');
const { sanitizeId } = require('../utils/sanitize');
const { assessGroup } = require('../services/crosscontamination.service');
const { getActiveSessionId } = require('../services/logsession.service');
const hub = require('../realtime/hub');

/** A log is visible if the session's clearance meets the log's required
 *  viewClearance, OR the session's role is explicitly granted access via
 *  roleOverrides regardless of clearance (rule #3). Returns a flag so the
 *  caller can render the "elevated access" indicator (rule #4). */
function checkAccess(log, session) {
    if (!session) return { visible: false, elevated: false };
    if (session.clearance >= (log.viewClearance || 0)) return { visible: true, elevated: false };
    if ((log.roleOverrides || []).includes(session.roleCode)) return { visible: true, elevated: true };
    return { visible: false, elevated: false };
}

function withAccessFlag(log, session) {
    const access = checkAccess(log, session);
    return { ...log, _elevatedAccess: access.elevated };
}

async function listLogs(req, res) {
    const all = await readAllLogs();
    const visible = all
        .filter(log => checkAccess(log, req.session).visible)
        .map(log => withAccessFlag(log, req.session));
    res.json(visible);
}

async function getLogById(req, res) {
    const log = await readLog(req.params.id);
    if (!log) return res.status(404).json({ error: 'Not found' });
    const access = checkAccess(log, req.session);
    if (!access.visible) {
        return res.status(403).json({ error: `Requires clearance level ${log.viewClearance}; your session is level ${req.session.clearance}.` });
    }
    res.json({ ...log, _elevatedAccess: access.elevated });
}

async function createLog(req, res) {
    const scps = await readSCPs();
    const id = req.body.id || uuidv4();

    if (await readLog(id)) {
        return res.status(409).json({ error: 'Conflict: ID already exists' });
    }

    const requestedClearance = Number.isInteger(req.body.viewClearance) ? req.body.viewClearance : 0;
    if (requestedClearance > req.session.clearance) {
        return res.status(403).json({ error: `You cannot assign a required clearance (${requestedClearance}) higher than your own session's clearance (${req.session.clearance}).` });
    }

    const now = new Date().toISOString();
    const crossScps = Array.isArray(req.body.crossScps) ? req.body.crossScps.filter(Boolean) : [];
    const crossContamination = crossScps.length ? assessGroup([req.body.scp, ...crossScps]) : [];
    const sessionId = req.body.sessionId || await getActiveSessionId();
    const log = normalizeLog({ ...req.body, id, createdAt: now, updatedAt: now, crossContamination, sessionId });
    if (!log) return res.status(400).json({ error: 'Invalid payload' });

    await saveLog(log, scps);
    await hub.broadcast('log:upsert', log, req.headers['x-client-id']);
    res.status(201).json(log);
}

async function updateLog(req, res) {
    const existing = await readLog(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const requestedClearance = Number.isInteger(req.body.viewClearance) ? req.body.viewClearance : existing.viewClearance;
    if (requestedClearance > req.session.clearance) {
        return res.status(403).json({ error: `You cannot assign a required clearance (${requestedClearance}) higher than your own session's clearance (${req.session.clearance}).` });
    }

    const scps = await readSCPs();
    const crossScps = Array.isArray(req.body.crossScps) ? req.body.crossScps.filter(Boolean) : existing.crossScps;
    const primaryScp = req.body.scp || existing.scp;
    const crossContamination = crossScps.length ? assessGroup([primaryScp, ...crossScps]) : [];
    const updated = normalizeLog({
        ...existing,
        ...req.body,
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString(),
        crossContamination
    });

    await saveLog(updated, scps);
    await hub.broadcast('log:upsert', updated, req.headers['x-client-id']);
    res.json(updated);
}

async function removeLog(req, res) {
    const existing = await readLog(req.params.id);
    if (!existing || !await deleteLogFile(req.params.id)) {
        return res.status(404).json({ error: 'Not found' });
    }
    await hub.broadcast('log:deleted', {
        id: req.params.id,
        _visibility: {
            viewClearance: existing.viewClearance,
            roleOverrides: existing.roleOverrides
        }
    }, req.headers['x-client-id']);
    res.json({ deleted: true });
}

async function exportLog(req, res) {
    const id = sanitizeId(req.params.id);
    const log = await readLog(id);
    if (!log) return res.status(404).json({ error: 'Not found' });
    if (!checkAccess(log, req.session).visible) {
        return res.status(403).json({ error: `Requires clearance level ${log.viewClearance}; your session is level ${req.session.clearance}.` });
    }

    const fp = path.join(LOGS_DIR, `${id}.md`);
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader(
        'Content-Disposition',
        `attachment; filename="SCP-${log?.scp || 'XXX'}-${id.slice(0, 8)}.md"`
    );
    res.sendFile(fp);
}

module.exports = { listLogs, getLogById, createLog, updateLog, removeLog, exportLog };
