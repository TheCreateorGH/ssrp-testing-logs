const hub = require('../realtime/hub');

/**
 * GET /api/stream — Server-Sent-Events endpoint. Keeps the HTTP
 * response open indefinitely and streams JSON events pushed by
 * hub.broadcast(). A comment-only ping is sent periodically to keep
 * intermediary proxies/load balancers from closing the idle connection.
 */
function stream(req, res) {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no' // disable nginx buffering, if fronted by one
    });
    res.write('retry: 3000\n\n');
    res.write(`event: hello\ndata: ${JSON.stringify({ ok: true, time: new Date().toISOString() })}\n\n`);

    hub.addClient(res);

    const pingInterval = setInterval(() => {
        try {
            res.write(': ping\n\n');
        } catch {
            clearInterval(pingInterval);
        }
    }, 25000);

    req.on('close', () => {
        clearInterval(pingInterval);
        hub.removeClient(res);
    });
}

module.exports = { stream };
