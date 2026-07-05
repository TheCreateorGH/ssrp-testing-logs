const yaml = require('js-yaml');
const { normalizeLog } = require('./normalize');
const { calcSurvivalRate } = require('./survival');

const FRONTMATTER_RE = /^---\r?\n([\s\S]+?)\r?\n---/;

/**
 * Parses a YAML-frontmatter markdown test log into a normalized log
 * object. Returns null if the frontmatter block is missing or invalid.
 */
function parseFrontmatter(content) {
    const match = content.match(FRONTMATTER_RE);
    if (!match) return null;
    try {
        return normalizeLog(yaml.load(match[1]));
    } catch {
        return null;
    }
}

/**
 * Parses a YAML-frontmatter markdown facility event into a plain
 * object (no normalization — events don't have a fixed schema like
 * logs do). Returns null if the frontmatter block is missing or invalid.
 */
function parseEventFrontmatter(content) {
    const match = content.match(FRONTMATTER_RE);
    if (!match) return null;
    try {
        return yaml.load(match[1]);
    } catch {
        return null;
    }
}

/** Renders a normalized log object into the full markdown document. */
function logToMarkdown(log, scps) {
    const scp = scps[log.scp] || {};
    const dateStr = (log.createdAt || '').split('T')[0] || 'N/A';
    const survival = calcSurvivalRate(log);

    const fm = yaml.dump({
        id: log.id,
        scp: log.scp,
        scpName: scp.name || '',
        scpClass: scp.class || '',
        sector: scp.sector || log.sector || '',
        requiredClearance: log.requiredClearance,
        location: log.location,
        researcher: log.researcherName,
        rank: log.researcherRank,
        ethicsObserver: log.ethicsObserver,
        createdAt: log.createdAt,
        updatedAt: log.updatedAt,
        finalStatus: log.finalStatus,
        finalSubStatus: log.finalSubStatus || '',
        survivalRate: survival,
        startAlarmLevel: log.startAlarmLevel,
        endAlarmLevel: log.endAlarmLevel,
        startThreatLevel: log.startThreatLevel,
        endThreatLevel: log.endThreatLevel,
        startCDCAlert: log.startCDCAlert,
        endCDCAlert: log.endCDCAlert,
        personnel: log.personnel,
        casualties: log.casualties,
        equipment: log.equipment,
        timeline: log.timeline,
        manualLogs: log.manualLogs,
        notes: log.notes || '',
        viewClearance: log.viewClearance ?? 0,
        roleOverrides: log.roleOverrides || [],
        crossScps: log.crossScps || [],
        crossContamination: log.crossContamination || []
    });

    const tlLines = (log.timeline || []).map(e =>
        `- \`${e.timestamp}\` — **${e.event}**`
    ).join('\n') || '_No events recorded._';

    const mlLines = (log.manualLogs || []).map(e =>
        `- \`${e.timestamp}\` — ${e.text}`
    ).join('\n') || '_No entries._';

    const equipList = Object.entries(log.equipment || {})
        .filter(([, v]) => v)
        .map(([k]) => `- ${{ scramblers: 'Scramblers', bag: 'Bag', lavender: 'Lavender', cageNeeded: 'Cage' }[k] || k}`)
        .join('\n') || '- None';

    return [
        '---', fm.trim(), '---', '',
        `# SCP-${log.scp} Test Log`,
        `**CLASSIFIED — FOUNDATION USE ONLY**`, '',
        `## Test Metadata`,
        `| Field | Value |`, `|---|---|`,
        `| SCP | SCP-${log.scp}${scp.name ? ` — ${scp.name}` : ''} |`,
        `| Class | ${(scp.class || '').toUpperCase()} |`,
        `| Sector | ${scp.sector || 'N/A'} |`,
        `| Clearance | Level ${log.requiredClearance} |`,
        `| Location | ${(log.location || '').toUpperCase()} |`,
        `| Date | ${dateStr} |`,
        `| Researcher | ${log.researcherName} (${log.researcherRank}) |`,
        `| Ethics Observer | ${log.ethicsObserver ? 'Yes' : 'No'} |`,
        `| Final Status | **${log.finalStatus}**${log.finalSubStatus ? ` — ${log.finalSubStatus}` : ''} |`,
        `| Survival Rate | ${survival}% |`, '',
        `## Alert State`,
        `| Phase | Alarm Level | Threat Level | CDC Alert |`, `|---|---|---|---|`,
        `| **Start** | ${log.startAlarmLevel} | ${log.startThreatLevel} | ${log.startCDCAlert} |`,
        `| **End** | ${log.endAlarmLevel} | ${log.endThreatLevel} | ${log.endCDCAlert} |`, '',
        `## Personnel`,
        `| Class-D | Security | MTF | RRT |`, `|---|---|---|---|`,
        `| ${log.personnel?.cd || 0} | ${log.personnel?.sd || 0} | ${log.personnel?.mtf || 0} | ${log.personnel?.rrt || 0} |`, '',
        `## Equipment`, equipList, '',
        `## Timeline`, tlLines, '',
        `## Manual Log Entries`, mlLines, '',
        `## Casualties`,
        `- **Terminated by Security:** ${log.casualties?.terminatedBySecurity || 0}`,
        `- **Killed by SCP:** ${log.casualties?.killedBySCP || 0}`,
        `- **Other Personnel Lost (SD/MTF/RRT):** ${log.casualties?.personnelLost || 0}`,
        `- **Survival Rate:** ${survival}%`, '',
        log.notes ? `## Notes\n\n${log.notes}\n` : '',
        (log.crossScps && log.crossScps.length) ? [
            '## Cross-Test Correlation',
            `Subjects tested concurrently: SCP-${log.scp}, ${log.crossScps.map(s => `SCP-${s}`).join(', ')}`,
            '',
            ...(log.crossContamination || []).map(c => `- **SCP-${c.scpA} × SCP-${c.scpB}** — Risk: ${(c.risk || 'unassessed').toUpperCase()} — ${c.reason}`)
        ].join('\n') + '\n' : '',
        '---', '',
        `*Signed: Researcher ${log.researcherName} | ${log.researcherRank} | ${dateStr}*`,
        `*SSRP Test Log System v2 — ${new Date().toISOString()}*`
    ].join('\n');
}

/** Renders a facility event object into its markdown document. */
function eventToMarkdown(event) {
    const fm = yaml.dump(event);
    return `---\n${fm.trim()}\n---\n\n# Facility Event: ${event.type}\nLogged on ${event.createdAt}\n`;
}

module.exports = {
    FRONTMATTER_RE,
    parseFrontmatter,
    parseEventFrontmatter,
    logToMarkdown,
    eventToMarkdown
};
