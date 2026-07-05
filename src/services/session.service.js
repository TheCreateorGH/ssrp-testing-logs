const crypto = require('crypto');
const { getRole } = require('../config/roles');

/** token -> { token, name, roleCode, clearance, createdAt } */
const sessions = new Map();

function createSession(name, roleCode) {
    const role = getRole(roleCode);
    if (!role) return null;
    const token = crypto.randomBytes(24).toString('hex');
    const session = {
        token,
        name: String(name || 'Unidentified').slice(0, 64),
        roleCode: role.code,
        roleName: role.name,
        clearance: role.clearance,
        createdAt: new Date().toISOString()
    };
    sessions.set(token, session);
    return session;
}

function getSession(token) {
    if (!token) return null;
    return sessions.get(token) || null;
}

function destroySession(token) {
    return sessions.delete(token);
}

module.exports = { createSession, getSession, destroySession };
