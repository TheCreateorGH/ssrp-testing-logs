const { listSchedules, createSchedule, deleteSchedule } = require('../services/schedule.service');

async function list(req, res) {
    res.json(await listSchedules());
}

async function create(req, res) {
    if (!req.body.scp) return res.status(400).json({ error: 'scp is required' });
    if (!req.body.scheduledFor) return res.status(400).json({ error: 'scheduledFor is required' });
    const schedule = await createSchedule({ ...req.body, createdBy: req.session?.name });
    res.status(201).json(schedule);
}

async function remove(req, res) {
    if (!await deleteSchedule(req.params.id)) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: true });
}

module.exports = { list, create, remove };
