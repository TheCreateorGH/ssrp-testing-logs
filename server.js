// Activated before anything else so every subsequent require/log call
// (including the bootstrap-admin banner) is already covered.
require('./src/debug/logger').activate();

const http = require('http');
const app = require('./src/app');
const { readAllLogs } = require('./src/services/log.service');
const scheduler = require('./src/realtime/scheduler');
const userService = require('./src/services/user.service');
const logSessionService = require('./src/services/logsession.service');
const { IP, PORT } = require('./src/config/network');
const websocket = require('./src/realtime/websocket');

app.post('/api/execute', async (req, res) => {
    const { command, args } = req.body;

    if (command === 'dellogs') {
        try {
            const logsDir = path.join(__dirname, 'facility_logs');

            await fs.access(logsDir);
            const files = await fs.readdir(logsDir);

            await Promise.all(
                files.map(file => fs.rm(path.join(logsDir, file), { recursive: true, force: true }))
            );

            return res.json({ output: 'Deleted all Logs.' });
        } catch (error) {
            if (error.code === 'ENOENT') {
                return res.json({ output: 'Log directory "facility_logs" does not exist.' });
            }
            return res.status(500).json({ error: 'Failed to delete logs.', details: error.message });
        }
    }

    return res.json({ output: `Unbekannter Server-Befehl: ${command}` });
});

(async () => {
    await userService.ensureBootstrapAdmin();
    await logSessionService.ensureDefaultSession();

    // An explicit http.Server (rather than the one app.listen() creates
    // implicitly) so the WebSocket server can attach to the same port
    // via the upgrade event.
    const server = http.createServer(app);
    websocket.attach(server);

    server.listen(PORT, IP, async () => {
        const logs = await readAllLogs();
        scheduler.start();
        console.silent(`
╔════════════════════════════════════════════════════╗
║  ☣  SSRP TEST LOG SYSTEM  v2.0  — ONLINE           ║
║  http://${IP}:${PORT}                             ║
║  WebSocket:  ws://${IP}:${PORT}/ws                 ║
║  Loaded ${String(logs.length).padEnd(3)} existing log(s) from /logs/        ║
╚════════════════════════════════════════════════════╝
`);
    });
})();
