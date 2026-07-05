const path = require('path');
const { existsSync, mkdirSync } = require('fs');

const ROOT_DIR = path.join(__dirname, '..', '..');

const DATA_DIR = path.join(ROOT_DIR, 'data');
const LOGS_DIR = path.join(ROOT_DIR, 'logs');
const EVENTS_DIR = path.join(ROOT_DIR, 'facility_logs');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

const SCPS_FILE = path.join(DATA_DIR, 'scps.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

/** Ensure the directories the app writes to actually exist. Call once at boot. */
function ensureDirs() {
    [DATA_DIR, LOGS_DIR, EVENTS_DIR].forEach(dir => {
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    });
}

module.exports = {
    ROOT_DIR,
    DATA_DIR,
    LOGS_DIR,
    EVENTS_DIR,
    PUBLIC_DIR,
    SCPS_FILE,
    SETTINGS_FILE,
    ensureDirs
};
