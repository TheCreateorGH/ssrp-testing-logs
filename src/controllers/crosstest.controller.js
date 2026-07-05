const { assessGroup } = require('../services/crosscontamination.service');

function assess(req, res) {
    const scps = Array.isArray(req.body.scps) ? req.body.scps.filter(Boolean) : [];
    if (scps.length < 2) return res.json({ pairs: [] });
    res.json({ pairs: assessGroup(scps) });
}

module.exports = { assess };
