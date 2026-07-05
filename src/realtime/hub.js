/**
 * In-memory registry of connected Server-Sent-Events clients.
 * Any controller can call broadcast(event, payload, originClientId)
 * to push a message to every connected browser tab in real time.
 */
const clients = new Set();

/** Register a new SSE response stream. */
function addClient(res) {
    clients.add(res);
}

/** Remove a disconnected SSE response stream. */
function removeClient(res) {
    clients.delete(res);
}

/**
 * Broadcasts a named event to every connected client.
 * @param {string} event - SSE event name (e.g. 'log:upsert')
 * @param {object} payload - JSON-serializable data
 * @param {string} [originClientId] - the X-Client-Id header of the
 *   request that caused this broadcast, so the originating tab can
 *   skip showing itself a "new entry" toast while still applying the
 *   (idempotent) update.
 */
function broadcast(event, payload, originClientId) {
    const body = JSON.stringify({ ...payload, _origin: originClientId || null });
    const frame = `event: ${event}\ndata: ${body}\n\n`;
    for (const res of clients) {
        try {
            res.write(frame);
        } catch {
            clients.delete(res);
        }
    }
}

function clientCount() {
    return clients.size;
}

module.exports = { addClient, removeClient, broadcast, clientCount };
