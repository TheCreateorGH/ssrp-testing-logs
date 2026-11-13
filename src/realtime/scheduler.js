const { pullDue } = require('../services/schedule.service');
const { readSCPs } = require('../services/scp.service');
const { saveLog } = require('../services/log.service');
const { normalizeLog } = require('../utils/normalize');
const hub = require('./hub');

const POLL_MS = 30000;

async function tick() {
    let due;
    try {
        due = await pullDue();
    } catch (err) {
        console.error('Scheduler: failed to read due schedules', err);
        return;
    }
    if (!due.length) return;

    const scps = await readSCPs();
    for (const schedule of due) {
        const now = new Date().toISOString();
        const draftLog = normalizeLog({
            scp: schedule.scp,
            personnel: schedule.personnel,
            researcherName: schedule.createdBy || '',
            notes: `Auto-generated from scheduled test${schedule.notes ? ` — ${schedule.notes}` : ''}.`,
            createdAt: now,
            updatedAt: now
        });
        try {
            await saveLog(draftLog, scps);
            await hub.broadcast('log:upsert', draftLog, null);
            await hub.broadcast('schedule:due', { schedule, logId: draftLog.id }, null);
        } catch (err) {
            console.error('Scheduler: failed to create draft log for schedule', schedule.id, err);
        }
    }
}

function start() {
    tick();
    setInterval(tick, POLL_MS);
}

module.exports = { start };
