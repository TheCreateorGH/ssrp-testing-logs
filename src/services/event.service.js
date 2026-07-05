const fs = require('fs').promises;
const path = require('path');

const { EVENTS_DIR } = require('../config/paths');
const { EventCache } = require('../cache/store');
const { parseEventFrontmatter, eventToMarkdown } = require('../utils/markdown');
const { sanitizeId } = require('../utils/sanitize');

/** Reads and parses every event in EVENTS_DIR, newest first. Corrupt files are skipped. */
async function readAllEvents() {
    const files = await fs.readdir(EVENTS_DIR);
    const mds = files.filter(f => f.endsWith('.md'));

    const events = await Promise.all(mds.map(async f => {
        const id = f.replace('.md', '');
        if (EventCache.has(id)) return EventCache.get(id);
        try {
            const content = await fs.readFile(path.join(EVENTS_DIR, f), 'utf8');
            const event = parseEventFrontmatter(content);
            if (event) EventCache.set(id, event);
            return event;
        } catch {
            return null;
        }
    }));

    return events.filter(Boolean).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/** Stamps updatedAt, writes the markdown file, and refreshes the cache. */
async function saveEvent(event) {
    event.updatedAt = new Date().toISOString();
    const md = eventToMarkdown(event);
    await fs.writeFile(path.join(EVENTS_DIR, `${event.id}.md`), md, 'utf8');
    EventCache.set(event.id, event);
    return event;
}

/** Deletes an event file and evicts it from cache. Returns false if it didn't exist. */
async function deleteEventFile(id) {
    id = sanitizeId(id);
    const fp = path.join(EVENTS_DIR, `${id}.md`);
    try {
        await fs.unlink(fp);
        EventCache.delete(id);
        return true;
    } catch {
        return false;
    }
}

module.exports = { readAllEvents, saveEvent, deleteEventFile };
