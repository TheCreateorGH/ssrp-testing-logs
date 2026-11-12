const fs = require('fs').promises;
const path = require('path');
const { DATA_DIR } = require('../config/paths');

const CONFIG_FILE = path.join(DATA_DIR, 'permissions_config.json');
const ROLE_OVERRIDES_FILE = path.join(DATA_DIR, 'role_permission_overrides.json');
const USER_OVERRIDES_FILE = path.join(DATA_DIR, 'user_permission_overrides.json');

let configCache = null;

/** The shipped config is the immutable source of truth for "reset".
 *  Cached in memory after first read since it never changes at runtime. */
async function loadConfig() {
    if (configCache) return configCache;
    configCache = JSON.parse(await fs.readFile(CONFIG_FILE, 'utf8'));
    return configCache;
}

async function readJsonSafe(file) {
    try { return JSON.parse(await fs.readFile(file, 'utf8')); }
    catch { return {}; }
}

async function writeJson(file, data) {
    await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf8');
}

async function getActionCatalog() {
    return (await loadConfig()).actions;
}

async function getRoleDefaultPermissions(role) {
    return (await loadConfig()).roleDefaults[role] || [];
}

async function getRoleOverridesMap() { return readJsonSafe(ROLE_OVERRIDES_FILE); }
async function getUserOverridesMap() { return readJsonSafe(USER_OVERRIDES_FILE); }

/** A role's *effective* permissions: the admin-edited override if one
 *  exists, otherwise the immutable JSON-config default. */
async function getRolePermissions(role) {
    const overrides = await getRoleOverridesMap();
    if (overrides[role]) return overrides[role];
    return getRoleDefaultPermissions(role);
}

/** A user's *effective* permissions: their own override if one exists,
 *  otherwise their assigned role's effective permissions. */
async function getUserPermissions(userId, role) {
    const overrides = await getUserOverridesMap();
    if (overrides[userId]) return overrides[userId];
    return getRolePermissions(role);
}

/** Wildcard-aware match against an "ACTION" catalog of the form
 *  "VERB:NOUN" — grants may use '*' for either segment, or '*:*'/'*'
 *  for everything. */
function matches(granted, action) {
    if (!Array.isArray(granted) || !action) return false;
    const [wantVerb, wantNoun] = String(action).split(':');
    return granted.some(g => {
        if (g === '*' || g === '*:*') return true;
        const [gv, gn] = String(g).split(':');
        const verbOk = gv === '*' || gv === wantVerb;
        const nounOk = gn === '*' || gn === wantNoun;
        return verbOk && nounOk;
    });
}

async function hasPermission(userId, role, action) {
    const effective = await getUserPermissions(userId, role);
    return matches(effective, action);
}

async function setRolePermissions(role, permissions) {
    const overrides = await getRoleOverridesMap();
    overrides[role] = permissions;
    await writeJson(ROLE_OVERRIDES_FILE, overrides);
}

/** "Resetting a role's permissions restores its original default
 *  permissions from the JSON config." */
async function resetRolePermissions(role) {
    const overrides = await getRoleOverridesMap();
    delete overrides[role];
    await writeJson(ROLE_OVERRIDES_FILE, overrides);
}

async function setUserPermissions(userId, permissions) {
    const overrides = await getUserOverridesMap();
    overrides[userId] = permissions;
    await writeJson(USER_OVERRIDES_FILE, overrides);
}

/** "Resetting a user's permissions deletes all user-specific overrides
 *  and strictly falls back to the default permissions of their
 *  assigned role." */
async function resetUserPermissions(userId) {
    const overrides = await getUserOverridesMap();
    delete overrides[userId];
    await writeJson(USER_OVERRIDES_FILE, overrides);
}

module.exports = {
    getActionCatalog, getRoleDefaultPermissions, getRolePermissions, getUserPermissions,
    matches, hasPermission,
    setRolePermissions, resetRolePermissions, setUserPermissions, resetUserPermissions,
    getRoleOverridesMap, getUserOverridesMap
};
