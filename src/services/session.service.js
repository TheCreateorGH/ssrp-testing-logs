const crypto = require('crypto');
const streamdeckTokenService = require('./streamdeck-token.service');

/** token -> { token, userId, username, name, roleCode, roleName, clearance, createdAt } */
const sessions = new Map();

function createSession(user, roleName) {
    const token = crypto.randomBytes(24).toString('hex');
    const session = {
        token,
        userId: user.id,
        username: user.username,
        name: user.displayName || user.username,
        roleCode: user.roleCode,
        roleName,
        clearance: user.clearance,
        mustChangePassword: !!user.mustChangePassword,
        createdAt: new Date().toISOString()
    };
    sessions.set(token, session);
    return session;
}

function getSession(token) {
    if (!token) return null;
    return sessions.get(token) || streamdeckTokenService.getSession(token);
}

function destroySession(token) {
    return sessions.delete(token);
}

/** Invalidates every active session belonging to a user — used when an
 *  admin deletes the account, resets the password, or changes the role,
 *  so a stale session can't keep acting under old privileges. */
function destroyAllSessionsForUser(userId) {
    for (const [token, session] of sessions) {
        if (session.userId === userId) sessions.delete(token);
    }
}

module.exports = { createSession, getSession, destroySession, destroyAllSessionsForUser };
