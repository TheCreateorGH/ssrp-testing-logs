const { readSCPs } = require('../services/scp.service');

async function getScps(req, res) {
    res.json(await readSCPs());
}

module.exports = { getScps };
