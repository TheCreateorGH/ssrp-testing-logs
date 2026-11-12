const permissionService = require('../services/permission.service');
const userService = require('../services/user.service');
const { ROLES } = require('../config/roles');

async function getCatalog(req, res) {
    res.json({ actions: await permissionService.getActionCatalog(), roles: Object.keys(ROLES) });
}

async function getRolePermissions(req, res) {
    const { role } = req.params;
    if (!ROLES[role]) return res.status(404).json({ error: 'Unknown role.' });
    const overrides = await permissionService.getRoleOverridesMap();
    res.json({
        role,
        permissions: await permissionService.getRolePermissions(role),
        defaultPermissions: await permissionService.getRoleDefaultPermissions(role),
        isCustomized: !!overrides[role]
    });
}

async function setRolePermissions(req, res) {
    const { role } = req.params;
    if (!ROLES[role]) return res.status(404).json({ error: 'Unknown role.' });
    const permissions = Array.isArray(req.body.permissions) ? req.body.permissions : [];

    // Bug fix #1 (system-wide guard): the ADMIN role must always retain
    // the ability to manage users and permissions, or a lockout would
    // require manually editing the JSON files to recover — for every
    // admin, not just the one making the change.
    if (role === 'ADMIN') {
        const stillHasUsers = permissionService.matches(permissions, 'ADMIN:USERS');
        const stillHasPerms = permissionService.matches(permissions, 'ADMIN:PERMISSIONS');
        if (!stillHasUsers || !stillHasPerms) {
            console.warn('[PERM] blocked an edit that would have stripped ADMIN:USERS/ADMIN:PERMISSIONS from the ADMIN role');
            return res.status(400).json({ error: 'The ADMIN role must always retain ADMIN:USERS and ADMIN:PERMISSIONS — this would lock out every administrator.' });
        }
    }

    await permissionService.setRolePermissions(role, permissions);
    console.log(`[PERM] ${req.user.username} set permissions for role ${role}: ${permissions.join(', ')}`);
    res.json({ role, permissions });
}

async function resetRolePermissions(req, res) {
    const { role } = req.params;
    if (!ROLES[role]) return res.status(404).json({ error: 'Unknown role.' });
    await permissionService.resetRolePermissions(role);
    console.log(`[PERM] ${req.user.username} reset role ${role} to JSON-config defaults`);
    res.json({ role, permissions: await permissionService.getRolePermissions(role) });
}

async function getUserPermissions(req, res) {
    const user = await userService.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    const overrides = await permissionService.getUserOverridesMap();
    res.json({
        userId: user.id,
        permissions: await permissionService.getUserPermissions(user.id, user.roleCode),
        rolePermissions: await permissionService.getRolePermissions(user.roleCode),
        isCustomized: !!overrides[user.id]
    });
}

async function setUserPermissions(req, res) {
    // Bug fix #1: an admin cannot edit their own permission overrides —
    // the same self-lockout vector as editing their own role/status.
    if (req.params.id === req.session.userId) {
        return res.status(400).json({ error: 'You cannot modify your own permission overrides. Ask another administrator.' });
    }
    const user = await userService.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    const permissions = Array.isArray(req.body.permissions) ? req.body.permissions : [];
    await permissionService.setUserPermissions(req.params.id, permissions);
    console.log(`[PERM] ${req.user.username} set permission override for user ${user.username}: ${permissions.join(', ')}`);
    res.json({ userId: req.params.id, permissions });
}

async function resetUserPermissions(req, res) {
    if (req.params.id === req.session.userId) {
        return res.status(400).json({ error: 'You cannot modify your own permission overrides. Ask another administrator.' });
    }
    const user = await userService.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    await permissionService.resetUserPermissions(req.params.id);
    console.log(`[PERM] ${req.user.username} reset permission override for user ${user.username}`);
    res.json({ userId: req.params.id, permissions: await permissionService.getUserPermissions(user.id, user.roleCode) });
}

module.exports = { getCatalog, getRolePermissions, setRolePermissions, resetRolePermissions, getUserPermissions, setUserPermissions, resetUserPermissions };
