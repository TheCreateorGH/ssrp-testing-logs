/** Foundation roles, each with a fixed clearance level 0-6.
 *  NOTE: action-level permissions no longer live here — see
 *  data/permissions_config.json + src/services/permission.service.js.
 *  This file is now only the identity/clearance reference. */
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

function getRole(code) {
    return ROLES[code] || null;
}

module.exports = { ROLES, getRole };
