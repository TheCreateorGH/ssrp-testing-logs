const { getOverrides, setOverride } = require('../services/containment.service');
const { canPerform } = require('../config/roles');
const hub = require('../realtime/hub');

async function list(req, res) {
    res.json(await getOverrides());
}

async function setStatus(req, res) {
    const { status } = req.body || {};
    if (!['secure', 'breached'].includes(status)) {
        return res.status(400).json({ error: "status must be 'secure' or 'breached'." });
    }
    // Reuse the same permission tier as declaring/ending a breach — resolving
    // an investigation is an equivalent security decision.
    const action = status === 'breached' ? 'BREACH' : 'BREACH_END';
    if (!canPerform(action, req.session.roleCode)) {
        return res.status(403).json({ error: `${req.session.roleName} (${req.session.roleCode}) is not authorized to set containment status.` });
    }
    const override = await setOverride(req.params.scp, status, req.session.name);
    hub.broadcast('containment:override', { scp: req.params.scp, ...override }, req.headers['x-client-id']);
    res.json(override);
}

module.exports = { list, setStatus };
