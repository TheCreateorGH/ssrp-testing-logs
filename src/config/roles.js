/** Foundation roles, each with a fixed clearance level 0-6. */
const ROLES = {
    SD: { code: 'SD', name: 'Security Department', clearance: 1 },
    MD: { code: 'MD', name: 'Medical Department', clearance: 1 },
    ScD: { code: 'ScD', name: 'Scientist', clearance: 2 },
    MTF: { code: 'MTF', name: 'Mobile Task Force', clearance: 3 },
    RRT: { code: 'RRT', name: 'Rapid Response Team', clearance: 3 },
    ISD: { code: 'ISD', name: 'Internal Security Department', clearance: 3 },
    IA: { code: 'IA', name: 'Intelligence Agency', clearance: 4 },
    SiD: { code: 'SiD', name: 'Site Director', clearance: 5 },
    O5: { code: 'O5', name: 'O5 Council', clearance: 6 },
    ADMIN: { code: 'ADMIN', name: 'The Administrator', clearance: 6 }
};

/** Which roles may trigger each Ops Console action. Enforced both here
 *  (server-side, authoritative) and mirrored client-side for UI gating. */
const OPS_PERMISSIONS = {
    BREACH: ['ISD', 'MTF', 'RRT', 'SiD', 'O5', 'ADMIN'],
    BREACH_END: ['ISD', 'MTF', 'RRT', 'SiD', 'O5', 'ADMIN'],
    CDC_RIOT: ['ISD', 'SD', 'SiD', 'O5', 'ADMIN'],
    ALARM: ['ISD', 'SiD', 'O5', 'ADMIN'],
    THREAT: ['ISD', 'IA', 'SiD', 'O5', 'ADMIN'],
    CDC: ['MD', 'ISD', 'SiD', 'O5', 'ADMIN'],
    BROADCAST: ['SiD', 'O5', 'ADMIN', 'IA'],
    WARHEAD: ['O5', 'ADMIN']
};

function getRole(code) {
    return ROLES[code] || null;
}

function canPerform(action, roleCode) {
    const allowed = OPS_PERMISSIONS[action];
    if (!allowed) return true; // ungated event types (e.g. plain manual events) are always allowed
    return allowed.includes(roleCode);
}

module.exports = { ROLES, OPS_PERMISSIONS, getRole, canPerform };
