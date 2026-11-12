const { isDebug } = require('./logger');

const SENSITIVE_FIELDS = ['password', 'oldPassword', 'newPassword', 'passwordHash', 'token'];

function redact(body) {
    if (!body || typeof body !== 'object') return body;
    const clone = { ...body };
    for (const field of SENSITIVE_FIELDS) {
        if (field in clone) clone[field] = '[REDACTED]';
    }
    return clone;
}

/** Express middleware. Logs every inbound request (method, URL, IP,
 *  payload) and, by wrapping res.end, every outbound response
 *  (status code, duration) at the moment it actually completes. */
function httpLogger(req, res, next) {
    if (!isDebug()) return next();

    const start = Date.now();
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const payload = (req.body && Object.keys(req.body).length) ? redact(req.body) : undefined;
    console.log(`→ HTTP ${req.method} ${req.originalUrl} from ${ip}`, payload ?? '');

    const originalEnd = res.end;
    res.end = function interceptedEnd(...args) {
        const duration = Date.now() - start;
        console.log(`← HTTP ${req.method} ${req.originalUrl} ${res.statusCode} (${duration}ms)`);
        return originalEnd.apply(res, args);
    };

    next();
}

module.exports = { httpLogger };
