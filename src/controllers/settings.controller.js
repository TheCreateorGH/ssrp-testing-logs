const { readSettings } = require('../services/settings.service');

async function getSettings(req, res) {
    res.json(await readSettings());
}

module.exports = { getSettings };
