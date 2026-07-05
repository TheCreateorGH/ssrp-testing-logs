const { parseFrontmatter } = require('../utils/markdown');
const { readSCPs } = require('../services/scp.service');
const { saveLog } = require('../services/log.service');
const hub = require('../realtime/hub');

async function importLog(req, res) {
    try {
        const content = req.body?.content || '';
        const log = parseFrontmatter(content);
        if (!log) return res.status(400).json({ error: 'Could not parse frontmatter' });

        if (log.viewClearance > req.session.clearance) {
            return res.status(403).json({ error: `Imported log requests clearance ${log.viewClearance}, higher than your session's clearance (${req.session.clearance}). Clamping is not permitted — adjust the frontmatter or import as a higher-clearance role.` });
        }

        await saveLog(log, await readSCPs());
        hub.broadcast('log:upsert', log, req.headers['x-client-id']);
        res.json({ success: true, log });
    } catch (e) {
        // Any failure here (bad YAML, bad payload shape) is a client
        // data problem, not a server fault — always 400.
        res.status(400).json({ error: e.message });
    }
}

module.exports = { importLog };
