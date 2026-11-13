const { WebSocketServer } = require('ws');
const { getSession } = require('../services/session.service');
const { isDebug } = require('../debug/logger');
const hub = require('./hub');
const permissionService = require('../services/permission.service');

let wss = null;

/** Wraps ws.send so every outgoing frame is logged before it's
 *  transmitted, per the DEBUG interceptor spec. */
function proxySend(ws, label) {
    const originalSend = ws.send.bind(ws);
    ws.send = (data, ...rest) => {
        if (isDebug()) console.log(`← WS OUT [${label}]`, typeof data === 'string' ? data : '(binary)');
        return originalSend(data, ...rest);
    };
}

function attach(server) {
    wss = new WebSocketServer({ server, path: '/ws' });

    wss.on('connection', async (ws, req) => {
        const url = new URL(req.url, 'http://localhost');
        const token = url.searchParams.get('token');
        const session = getSession(token);

        if (!session) {
            if (isDebug()) console.warn(`→ WS connection REJECTED (invalid/missing token) from ${req.socket.remoteAddress}`);
            ws.close(4001, 'Unauthorized');
            return;
        }

        try {
            await permissionService.getUserPermissions(session.userId, session.roleCode);
        } catch (err) {
            if (isDebug()) console.error(`→ WS AUTH ERROR from ${req.socket.remoteAddress}`, err.message);
            ws.close(1011, 'Authorization unavailable');
            return;
        }

        const label = `${session.username}@${req.socket.remoteAddress}`;
        if (isDebug()) console.log(`→ WS CONNECTED [${label}]`);

        proxySend(ws, label);
        hub.addWsClient(ws, { sessionToken: session.token });

        ws.send(JSON.stringify({ type: 'hello', time: new Date().toISOString() }));

        ws.on('message', raw => {
            if (isDebug()) console.log(`→ WS IN [${label}]`, raw.toString());
            let msg;
            try { msg = JSON.parse(raw.toString()); } catch { return; }
            if (msg.type === 'ping') ws.send(JSON.stringify({ type: 'pong', time: new Date().toISOString() }));
        });

        ws.on('close', () => {
            if (isDebug()) console.log(`→ WS DISCONNECTED [${label}]`);
            hub.removeWsClient(ws);
        });

        ws.on('error', err => {
            if (isDebug()) console.error(`→ WS ERROR [${label}]`, err.message);
        });
    });

    return wss;
}

module.exports = { attach };
