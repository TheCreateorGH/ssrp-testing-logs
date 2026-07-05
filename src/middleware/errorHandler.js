/** 404 fallback for unmatched /api/* routes. */
function notFoundHandler(req, res) {
    res.status(404).json({ error: 'Not found' });
}

/**
 * Centralized error handler. Any error passed to next(err) — including
 * ones forwarded by asyncHandler — lands here instead of crashing the
 * process or leaking a stack trace to the client.
 *
 * Controllers can set `err.status` to control the response code
 * (defaults to 500).
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
    console.error('Unhandled error:', err);
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Internal server error' });
}

module.exports = { errorHandler, notFoundHandler };
