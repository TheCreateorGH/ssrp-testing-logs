/**
 * Reduces an arbitrary id string to a safe filename component:
 * alphanumeric + hyphen only, capped at 64 chars. Prevents path
 * traversal (e.g. "../../etc/passwd") when the id is used to build
 * a file path.
 */
function sanitizeId(id) {
    return String(id || '').replace(/[^a-z0-9-]/gi, '').slice(0, 64);
}

module.exports = { sanitizeId };
