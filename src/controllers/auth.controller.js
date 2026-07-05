const { ROLES } = require('../config/roles');
const { createSession, destroySession } = require('../services/session.service');

function listRoles(req, res) {
    res.json(Object.values(ROLES));
}

function login(req, res) {
    const { name, role } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'Name is required.' });
    if (!role || !ROLES[role]) return res.status(400).json({ error: 'A valid role is required.' });

    const session = createSession(name, role);
    res.status(201).json(session);
}

function logout(req, res) {
    const token = req.headers['x-session-token'];
    destroySession(token);
    res.json({ loggedOut: true });
}

function whoami(req, res) {
    if (!req.session) return res.status(401).json({ error: 'No active session.' });
    res.json(req.session);
}

module.exports = { listRoles, login, logout, whoami };
