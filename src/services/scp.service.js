const fs = require('fs').promises;
const { SCPS_FILE } = require('../config/paths');

/** Reads the SCP registry. Returns {} if the file is missing or invalid. */
async function readSCPs() {
    try {
        return JSON.parse(await fs.readFile(SCPS_FILE, 'utf8'));
    } catch {
        return {};
    }
}

module.exports = { readSCPs };
