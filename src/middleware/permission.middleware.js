const userService = require('../services/user.service');
const permissionService = require('../services/permission.service');
const { destroySession } = require('../services/session.service');

/**
 * Every protected request must pass through here first. It does NOT
 * trust the in-memory session cache alone — it re-fetches the user
 * record from the persistent store and confirms both that the account
 * still exists and that its status is ACTIVE (not PENDING/SUSPENDED/
 * LOCKED), exactly as required. A stale/invalid session is destroyed
 * on the spot so it can't be reused.
 */
async function verifyIdentity(req, res, next) {
    if (!req.session) {
        console.debug('[AUTH] rejected — no session token presented');
        return res.status(401).json({ error: 'No active session. Please sign in.' });
    }

    console.debug(`[AUTH] verifying identity for userId=${req.session.userId}`);
    const user = await userService.findById(req.session.userId);

    if (!user) {
        console.warn(`[AUTH] session token points to a deleted user (${req.session.userId}) — destroying session`);
        destroySession(req.session.token);
        return res.status(401).json({ error: 'Account no longer exists.' });
    }
    if (user.status !== 'ACTIVE') {
        console.warn(`[AUTH] user ${user.username} has status ${user.status} — rejecting and destroying session`);
        destroySession(req.session.token);
        return res.status(401).json({ error: `Account is ${user.status.toLowerCase()}.`, reason: user.status });
    }

    // Refresh the session's mutable fields from the authoritative DB
    // record, so a role/clearance edit takes effect immediately even
    // if session invalidation somehow didn't already handle it.
    req.session.roleCode = user.roleCode;
    req.session.clearance = user.clearance;
    req.session.name = user.displayName || user.username;
    req.session.username = user.username;
    req.user = user;

    console.debug(`[AUTH] identity OK — ${user.username} (${user.roleCode}, status=${user.status})`);
    next();
}

/** Granular per-action permission gate. Must run after verifyIdentity. */
function requirePermission(action) {
    return async (req, res, next) => {
        console.debug(`[PERM] checking "${action}" for ${req.user?.username}`);
        const allowed = await permissionService.hasPermission(req.user.id, req.user.roleCode, action);
        if (!allowed) {
            console.warn(`[PERM] DENIED "${action}" for ${req.user.username} (${req.user.roleCode})`);
            return res.status(403).json({ error: `Missing permission: ${action}` });
        }
        console.debug(`[PERM] GRANTED "${action}" for ${req.user.username}`);
        next();
    };
}

module.exports = { verifyIdentity, requirePermission };
