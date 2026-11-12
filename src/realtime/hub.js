/**
 * In-memory registry of connected realtime clients — both Server-Sent-
 * Events (the primary channel the frontend uses) and WebSocket (the
 * secondary channel that exists so the DEBUG interceptor layer has
 * genuine ws.send traffic to log). Any controller can call broadcast()
 * to push a message to every connected client on both channels.
 */
const sseClients = new Set();
const wsClients = new Set();

/** Register a new SSE response stream. */
function addClient(res) {
    sseClients.add(res);
}

/** Remove a disconnected SSE response stream. */
function removeClient(res) {
    sseClients.delete(res);
}

function addWsClient(ws) {
    wsClients.add(ws);
}

function removeWsClient(ws) {
    wsClients.delete(ws);
}

/**
 * Broadcasts a named event to every connected client on every channel.
 * @param {string} event - event name (e.g. 'log:upsert')
 * @param {object} payload - JSON-serializable data
 * @param {string} [originClientId] - the X-Client-Id header of the
 *   request that caused this broadcast, so the originating tab can
 *   skip showing itself a "new entry" toast while still applying the
 *   (idempotent) update.
 */
function broadcast(event, payload, originClientId) {
    const body = JSON.stringify({ ...payload, _origin: originClientId || null });

    const sseFrame = `event: ${event}\ndata: ${body}\n\n`;
    for (const res of sseClients) {
        try { res.write(sseFrame); }
        catch { sseClients.delete(res); }
    }

    const wsFrame = JSON.stringify({ type: event, ...JSON.parse(body) });
    for (const ws of wsClients) {
        try { if (ws.readyState === 1) ws.send(wsFrame); }
        catch { wsClients.delete(ws); }
    }
}

function clientCount() {
    return { sse: sseClients.size, ws: wsClients.size };
}

module.exports = { addClient, removeClient, addWsClient, removeWsClient, broadcast, clientCount };
