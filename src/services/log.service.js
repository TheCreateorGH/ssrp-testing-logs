const fs = require('fs').promises;
const path = require('path');

const { LOGS_DIR } = require('../config/paths');
const { LogCache } = require('../cache/store');
const { parseFrontmatter, logToMarkdown } = require('../utils/markdown');
const { calcSurvivalRate } = require('../utils/survival');
const { sanitizeId } = require('../utils/sanitize');

/** Reads and parses every log in LOGS_DIR, newest first. Corrupt files are skipped. */
async function readAllLogs() {
    const files = await fs.readdir(LOGS_DIR);
    const mds = files.filter(f => f.endsWith('.md'));

    const logs = await Promise.all(mds.map(async f => {
        const id = f.replace('.md', '');
        if (LogCache.has(id)) return LogCache.get(id);
        try {
            const content = await fs.readFile(path.join(LOGS_DIR, f), 'utf8');
            const log = parseFrontmatter(content);
            if (log) LogCache.set(id, log);
            return log;
        } catch {
            return null;
        }
    }));

    return logs.filter(Boolean).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/** Reads a single log by id. Returns null if not found or unparsable. */
async function readLog(id) {
    id = sanitizeId(id);
    if (LogCache.has(id)) return LogCache.get(id);

    const fp = path.join(LOGS_DIR, `${id}.md`);
    try {
        const content = await fs.readFile(fp, 'utf8');
        const log = parseFrontmatter(content);
        if (log) LogCache.set(id, log);
        return log;
    } catch {
        return null;
    }
}

/** Recomputes survival rate, stamps updatedAt, writes the markdown file, and refreshes the cache. */
async function saveLog(log, scps) {
    log.survivalRate = calcSurvivalRate(log);
    log.updatedAt = new Date().toISOString();

    const md = logToMarkdown(log, scps);
    await fs.writeFile(path.join(LOGS_DIR, `${log.id}.md`), md, 'utf8');
    LogCache.set(log.id, log);
    return log;
}

/** Deletes a log file and evicts it from cache. Returns false if it didn't exist. */
async function deleteLogFile(id) {
    id = sanitizeId(id);
    const fp = path.join(LOGS_DIR, `${id}.md`);
    try {
        await fs.unlink(fp);
        LogCache.delete(id);
        return true;
    } catch {
        return false;
    }
}

module.exports = { readAllLogs, readLog, saveLog, deleteLogFile };
