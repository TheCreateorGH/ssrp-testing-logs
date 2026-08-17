const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { DATA_DIR } = require('../config/paths');

const FILE = path.join(DATA_DIR, 'log_sessions.json');

async function readAll() {
    try {
        return JSON.parse(await fs.readFile(FILE, 'utf8'));
    } catch {
        return [];
    }
}

async function writeAll(sessions) {
    await fs.writeFile(FILE, JSON.stringify(sessions, null, 2), 'utf8');
}

async function listSessions() {
    const all = await readAll();
    return all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function getActiveSession() {
    const all = await readAll();
    return all.find(s => s.active) || null;
}

async function getActiveSessionId() {
    const active = await getActiveSession();
    return active ? active.id : null;
}

/** Ensures at least one session exists so logs/events always have a
 *  home even before anyone explicitly starts one. */
async function ensureDefaultSession() {
    const all = await readAll();
    if (all.length) return;
    all.push({
        id: uuidv4(),
        label: 'Session 1',
        createdAt: new Date().toISOString(),
        createdBy: 'System',
        active: true
    });
    await writeAll(all);
}

/** Starts a new active facility session, deactivating whichever one was
 *  active before. Existing logs/events keep their original sessionId —
 *  nothing is deleted or moved, the board is just "collapsible by session". */
async function createSession(createdBy) {
    const all = await readAll();
    all.forEach(s => { s.active = false; });
    const session = {
        id: uuidv4(),
        label: `Session ${all.length + 1}`,
        createdAt: new Date().toISOString(),
        createdBy: createdBy || 'Unknown',
        active: true
    };
    all.push(session);
    await writeAll(all);
    return session;
}

module.exports = { listSessions, getActiveSession, getActiveSessionId, ensureDefaultSession, createSession };
