/**
 * In-memory registry of connected realtime clients — both Server-Sent-
 * Events (the primary channel the frontend uses) and WebSocket (the
 * secondary channel that exists so the DEBUG interceptor layer has
 * genuine ws.send traffic to log). Any controller can call broadcast()
 * to push a message to every connected client on both channels.
 */
const sseClients = new Set();
const wsClients = new Set();
const { audienceFor } = require('./visibility');
const { getSession } = require('../services/session.service');
const userService = require('../services/user.service');
const permissionService = require('../services/permission.service');

/** Register a new SSE response stream. */
function addClient(res, context = {}) {
    sseClients.add({ res, context });
}

/** Remove a disconnected SSE response stream. */
function removeClient(res) {
    for (const client of sseClients) {
        if (client.res === res) sseClients.delete(client);
    }
}

function addWsClient(ws, context = {}) {
    wsClients.add({ ws, context });
}

function removeWsClient(ws) {
    for (const client of wsClients) {
        if (client.ws === ws) wsClients.delete(client);
    }
}

/**
 * Refreshes the authorization context for a connected client. Realtime
 * connections outlive normal HTTP requests, so their session and permissions
 * must not be trusted after the initial handshake.
 */
async function getCurrentContext(client) {
    const token = client.context.sessionToken || client.context.session?.token;
    const storedSession = getSession(token);
    if (!storedSession) return null;

    const user = await userService.findById(storedSession.userId);
    if (!user || user.status !== 'ACTIVE') return null;

    const session = {
        ...storedSession,
        username: user.username,
        name: user.displayName || user.username,
        roleCode: user.roleCode,
        clearance: user.clearance
    };
    const permissions = await permissionService.getUserPermissions(user.id, user.roleCode);
    return { session, permissions };
}

function disconnect(client, channel) {
    if (channel === 'sse') {
        try { client.res.end(); } catch { /* already closed */ }
        sseClients.delete(client);
        return;
    }
    try { client.ws.close(4001, 'Unauthorized'); } catch { /* already closed */ }
    wsClients.delete(client);
}

/**
 * Broadcasts a named event to every connected client on every channel.
 * @param {string} event - event name (e.g. 'log:upsert')
 * @param {object} payload - JSON-serializable data
 * @param {string} [originClientId] - the X-Client-Id header of the
 *   request that caused this broadcast, so the originating tab can
 *   skip showing itself a "new entry" toast while still applying the
 *   (idempotent) update.
 * @param {(context: object) => boolean} [audience] - optional per-client
 *   authorization predicate.
 */
async function broadcast(event, payload, originClientId, audience) {
    const recipientFilter = audience || audienceFor(event, payload);
    const { _visibility, ...publicPayload } = payload;
    const body = JSON.stringify({ ...publicPayload, _origin: originClientId || null });

    const sseFrame = `event: ${event}\ndata: ${body}\n\n`;
    for (const client of sseClients) {
        let context;
        try {
            context = await getCurrentContext(client);
        } catch (err) {
            console.error('Realtime SSE authorization refresh failed', err);
            disconnect(client, 'sse');
            continue;
        }
        if (!context) {
            disconnect(client, 'sse');
            continue;
        }
        if (!recipientFilter(context)) continue;
        try { client.res.write(sseFrame); }
        catch { sseClients.delete(client); }
    }

    const wsFrame = JSON.stringify({ type: event, ...JSON.parse(body) });
    for (const client of wsClients) {
        let context;
        try {
            context = await getCurrentContext(client);
        } catch (err) {
            console.error('Realtime WebSocket authorization refresh failed', err);
            disconnect(client, 'ws');
            continue;
        }
        if (!context) {
            disconnect(client, 'ws');
            continue;
        }
        if (!recipientFilter(context)) continue;
        try { if (client.ws.readyState === 1) client.ws.send(wsFrame); }
        catch { wsClients.delete(client); }
    }
}

function clientCount() {
    return { sse: sseClients.size, ws: wsClients.size };
}

module.exports = { addClient, removeClient, addWsClient, removeWsClient, broadcast, clientCount };
