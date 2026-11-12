const { getOverrides, setOverride } = require('../services/containment.service');
const hub = require('../realtime/hub');

async function list(req, res) {
    res.json(await getOverrides());
}

async function setStatus(req, res) {
    const { status } = req.body || {};
    if (!['secure', 'breached'].includes(status)) {
        return res.status(400).json({ error: "status must be 'secure' or 'breached'." });
    }
    // Permission already checked by requirePermission('MANAGE:CONTAINMENT') at the route level.
    const override = await setOverride(req.params.scp, status, req.session.name);
    hub.broadcast('containment:override', { scp: req.params.scp, ...override }, req.headers['x-client-id']);
    res.json(override);
}

module.exports = { list, setStatus };
