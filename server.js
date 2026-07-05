const app = require('./src/app');
const { readAllLogs } = require('./src/services/log.service');
const scheduler = require('./src/realtime/scheduler');

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
    const logs = await readAllLogs();
    scheduler.start();
    console.log(`
╔════════════════════════════════════════════════════╗
║  ☣  SSRP TEST LOG SYSTEM  v2.0  — ONLINE           ║
║  http://localhost:${PORT}                             ║
║  Loaded ${String(logs.length).padEnd(3)} existing log(s) from /logs/        ║
╚════════════════════════════════════════════════════╝
`);
});
