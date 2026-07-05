// In-memory caches keyed by record id. Populated lazily on first read,
// invalidated on write/delete. Shared as singletons across services.
const LogCache = new Map();
const EventCache = new Map();

module.exports = { LogCache, EventCache };
