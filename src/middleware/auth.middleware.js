const { getSession } = require('../services/session.service');
const { canPerform } = require('../config/roles');

/** Reads the session token from either the X-Session-Token header
 *  (normal fetch/XHR) or a ?token= query param (needed for EventSource,
 *  which cannot send custom headers), and attaches req.session. */
function attachSession(req, res, next) {
    const token = req.headers['x-session-token'] || req.query.token;
    req.session = getSession(token);
    next();
}

/** Blocks the request with an authentic 401 if there's no valid session. */
function requireAuth(req, res, next) {
    if (!req.session) {
        return res.status(401).json({ error: 'No active session. Please sign in.' });
    }
    next();
}

/** Blocks with 403 unless the session's clearance meets the minimum. */
function requireClearance(minLevel) {
    return (req, res, next) => {
        if (!req.session) return res.status(401).json({ error: 'No active session. Please sign in.' });
        if (req.session.clearance < minLevel) {
            return res.status(403).json({ error: `Requires clearance level ${minLevel}; your session is level ${req.session.clearance}.` });
        }
        next();
    };
}

/** Blocks with 403 unless the session's role is permitted to perform
 *  the given Ops Console action (BREACH, WARHEAD, ALARM, etc). */
function requireOpsPermission(action) {
    return (req, res, next) => {
        if (!req.session) return res.status(401).json({ error: 'No active session. Please sign in.' });
        if (!canPerform(action, req.session.roleCode)) {
            return res.status(403).json({ error: `${req.session.roleName} (${req.session.roleCode}) is not authorized to perform ${action}.` });
        }
        next();
    };
}

module.exports = { attachSession, requireAuth, requireClearance, requireOpsPermission };
