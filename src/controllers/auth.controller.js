const { ROLES, getRole } = require('../config/roles');
const userService = require('../services/user.service');
const permissionService = require('../services/permission.service');
const { createSession, destroySession, destroyAllSessionsForUser } = require('../services/session.service');

function listRoles(req, res) {
    res.json(Object.values(ROLES));
}

async function register(req, res) {
    const { username, password, displayName } = req.body || {};
    if (!username || String(username).trim().length < 3) {
        return res.status(400).json({ error: 'Username must be at least 3 characters.' });
    }
    if (!password || String(password).length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }
    try {
        const user = await userService.register({ username, password, displayName });
        console.log(`[AUTH] new registration: ${user.username} (status=PENDING)`);
        res.status(201).json({
            registered: true,
            message: 'Account created. An administrator must approve your account and assign a role before you can sign in.',
            user
        });
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
    }
}

async function login(req, res) {
    const { username, password, rememberMe } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' });

    try {
        const user = await userService.authenticate(username, password);
        const role = getRole(user.roleCode);
        const session = createSession(user, role ? role.name : null);
        const permissions = await permissionService.getUserPermissions(user.id, user.roleCode);
        console.log(`[AUTH] ${user.username} signed in (role=${user.roleCode})`);
        res.status(201).json({ ...session, rememberMe: !!rememberMe, permissions });
    } catch (err) {
        console.warn(`[AUTH] failed login attempt for "${username}": ${err.message}`);
        res.status(err.status || 500).json({ error: err.message, reason: err.reason || null });
    }
}

function logout(req, res) {
    const token = req.headers['x-session-token'] || req.query.token;
    destroySession(token);
    res.json({ loggedOut: true });
}

async function whoami(req, res) {
    if (!req.session) return res.status(401).json({ error: 'No active session.' });
    const permissions = await permissionService.getUserPermissions(req.session.userId, req.session.roleCode);
    res.json({ ...req.session, permissions });
}

async function changePassword(req, res) {
    const { oldPassword, newPassword } = req.body || {};
    if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    }
    try {
        await userService.changePassword(req.session.userId, oldPassword, newPassword);
        destroyAllSessionsForUser(req.session.userId);
        console.log(`[AUTH] ${req.session.username} changed their password`);
        res.json({ changed: true, message: 'Password updated. Please sign in again.' });
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
    }
}

module.exports = { listRoles, register, login, logout, whoami, changePassword };
