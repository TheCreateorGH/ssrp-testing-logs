const fs = require('fs').promises;
const path = require('path');
const { DATA_DIR } = require('../config/paths');

const FILE = path.join(DATA_DIR, 'containment_overrides.json');

async function readAll() {
    try {
        return JSON.parse(await fs.readFile(FILE, 'utf8'));
    } catch {
        return {};
    }
}

async function writeAll(data) {
    await fs.writeFile(FILE, JSON.stringify(data, null, 2), 'utf8');
}

async function getOverrides() {
    return readAll();
}

/** Records an admin/security decision on a subject's containment state.
 *  status is 'secure' or 'breached' ("Fine" and "Breached" buttons). The
 *  timestamp lets the frontend's derivation logic know this override is
 *  newer than whatever log/event previously implied "Under Investigation". */
async function setOverride(scp, status, setBy) {
    const all = await readAll();
    all[scp] = { status, setBy, setAt: new Date().toISOString() };
    await writeAll(all);
    return all[scp];
}

module.exports = { getOverrides, setOverride };
