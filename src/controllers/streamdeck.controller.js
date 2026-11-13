const controlService = require('../services/control.service');
const userService = require('../services/user.service');

async function provisionToken(req, res) {
    res.status(201).json(await userService.provisionStreamDeckToken(req.user.id));
}

async function snapshot(req, res) {
    res.json(await controlService.getSnapshot());
}

async function alarm(req, res) {
    res.status(201).json(await controlService.changeAlarm(req, req.params.value));
}

async function threat(req, res) {
    res.status(201).json(await controlService.changeThreat(req, req.params.value));
}

async function cdc(req, res) {
    res.status(201).json(await controlService.changeCdc(req, req.params.value));
}

async function warhead(req, res) {
    res.status(201).json(await controlService.changeWarhead(req, req.params.action));
}

module.exports = { provisionToken, snapshot, alarm, threat, cdc, warhead };
