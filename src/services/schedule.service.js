const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { DATA_DIR } = require('../config/paths');

const SCHEDULES_FILE = path.join(DATA_DIR, 'schedules.json');

async function readAll() {
    try {
        const raw = await fs.readFile(SCHEDULES_FILE, 'utf8');
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

async function writeAll(schedules) {
    await fs.writeFile(SCHEDULES_FILE, JSON.stringify(schedules, null, 2), 'utf8');
}

async function listSchedules() {
    const all = await readAll();
    return all.sort((a, b) => new Date(a.scheduledFor) - new Date(b.scheduledFor));
}

async function createSchedule(data) {
    const schedules = await readAll();
    const schedule = {
        id: uuidv4(),
        scp: String(data.scp || ''),
        personnel: Object.assign({ cd: 0, sd: 0, mtf: 0, rrt: 0 }, data.personnel),
        scheduledFor: data.scheduledFor,
        recurrence: ['once', 'daily', 'weekly'].includes(data.recurrence) ? data.recurrence : 'once',
        notes: data.notes || '',
        createdBy: data.createdBy || 'Unknown',
        createdAt: new Date().toISOString(),
        firedAt: null,
        active: true
    };
    schedules.push(schedule);
    await writeAll(schedules);
    return schedule;
}

async function deleteSchedule(id) {
    const schedules = await readAll();
    const next = schedules.filter(s => s.id !== id);
    if (next.length === schedules.length) return false;
    await writeAll(next);
    return true;
}

function advance(dateIso, recurrence) {
    const d = new Date(dateIso);
    if (recurrence === 'daily') d.setUTCDate(d.getUTCDate() + 1);
    else if (recurrence === 'weekly') d.setUTCDate(d.getUTCDate() + 7);
    return d.toISOString();
}

/** Finds schedules due now, marks them fired (rolling recurring ones
 *  forward to their next occurrence), and returns the due list for the
 *  caller to turn into draft logs + broadcast reminders. */
async function pullDue() {
    const schedules = await readAll();
    const now = Date.now();
    const due = [];
    for (const s of schedules) {
        if (!s.active) continue;
        if (new Date(s.scheduledFor).getTime() > now) continue;
        due.push({ ...s });
        if (s.recurrence === 'once') {
            s.active = false;
            s.firedAt = new Date().toISOString();
        } else {
            s.firedAt = new Date().toISOString();
            s.scheduledFor = advance(s.scheduledFor, s.recurrence);
        }
    }
    if (due.length) await writeAll(schedules);
    return due;
}

module.exports = { listSchedules, createSchedule, deleteSchedule, pullDue };
