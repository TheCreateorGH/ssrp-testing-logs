const { v4: uuidv4 } = require('uuid');

/**
 * Coerces a raw log-like object (from an API request body, a parsed
 * markdown frontmatter block, or an import) into the canonical log
 * shape, filling in defaults for anything missing. Also tolerates a
 * couple of legacy/alias field names (`clearance`, `researcher`, `rank`,
 * `date`) from older log formats.
 *
 * Returns null only when given a falsy input.
 */
function normalizeLog(d) {
    if (!d) return null;

    return {
        id: d.id || uuidv4(),
        scp: String(d.scp || ''),
        requiredClearance: d.requiredClearance ?? d.clearance ?? 1,
        location: d.location || 'c1',
        sector: d.sector || '',
        equipment: Object.assign(
            { scramblers: false, bag: false, lavender: false, cageNeeded: false },
            d.equipment
        ),
        personnel: Object.assign({ cd: 0, sd: 0, mtf: 0, rrt: 0 }, d.personnel),
        researcherName: d.researcher || d.researcherName || '',
        researcherRank: d.rank || d.researcherRank || '',
        ethicsObserver: !!d.ethicsObserver,
        createdAt: d.createdAt || d.date || new Date().toISOString(),
        updatedAt: d.updatedAt || new Date().toISOString(),
        finalStatus: d.finalStatus || 'Success',
        finalSubStatus: d.finalSubStatus || '',
        survivalRate: d.survivalRate ?? 100,

        // Alert system
        startAlarmLevel: d.startAlarmLevel || 'None',
        endAlarmLevel: d.endAlarmLevel || 'None',
        startThreatLevel: d.startThreatLevel || 'Low',
        endThreatLevel: d.endThreatLevel || 'Low',
        startCDCAlert: d.startCDCAlert || 'Unknown',
        endCDCAlert: d.endCDCAlert || 'Unknown',

        // Casualties (v2 model)
        casualties: Object.assign(
            { terminatedBySecurity: 0, killedBySCP: 0, personnelLost: 0 },
            d.casualties
        ),

        timeline: Array.isArray(d.timeline) ? d.timeline : [],
        manualLogs: Array.isArray(d.manualLogs) ? d.manualLogs : [],
        notes: d.notes || '',

        // Clearance / role-override access control
        viewClearance: Number.isInteger(d.viewClearance) ? Math.min(6, Math.max(0, d.viewClearance)) : 0,
        roleOverrides: Array.isArray(d.roleOverrides) ? d.roleOverrides.filter(r => typeof r === 'string') : [],

        // Cross-test correlation
        crossScps: Array.isArray(d.crossScps) ? [...new Set(d.crossScps.map(String).filter(Boolean))] : [],
        crossContamination: Array.isArray(d.crossContamination) ? d.crossContamination : []
    };
}

module.exports = { normalizeLog };
