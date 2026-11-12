const controlService = require('../services/control.service');

async function snapshot(req, res) {
    res.json(await controlService.getSnapshot());
}

async function alarm(req, res) {
    res.status(201).json(await controlService.changeAlarm(req, req.body?.value));
}

async function threat(req, res) {
    res.status(201).json(await controlService.changeThreat(req, req.body?.value));
}

async function cdc(req, res) {
    res.status(201).json(await controlService.changeCdc(req, req.body?.value));
}

async function incident(req, res) {
    res.status(201).json(await controlService.changeIncident(req, req.body || {}));
}

async function warhead(req, res) {
    res.status(201).json(await controlService.changeWarhead(req, req.body?.action));
}

module.exports = { snapshot, alarm, threat, cdc, incident, warhead };
