const fs = require('fs').promises;
const { SETTINGS_FILE } = require('../config/paths');

const DEFAULT_SETTINGS = {
    site_title: '☣ SSRP — Test Log System v2',
    site_logo: '☣ SSRP',
    site_sub_logo: 'Test Log System — v2.0',
    default_researcher_name: '',
    default_researcher_rank: ''
};

/** Reads site settings. Returns DEFAULT_SETTINGS if the file is missing or invalid. */
async function readSettings() {
    try {
        return JSON.parse(await fs.readFile(SETTINGS_FILE, 'utf8'));
    } catch {
        return { ...DEFAULT_SETTINGS };
    }
}

module.exports = { readSettings, DEFAULT_SETTINGS };
