const userService = require('../services/user.service');
const { destroyAllSessionsForUser } = require('../services/session.service');

async function listUsers(req, res) {
    res.json(await userService.listUsers());
}

async function updateUser(req, res) {
    // Bug fix #1 (Admin Self-Softlock): an admin editing their own status
    // or role is exactly how the lockout happened before (unapprove /
    // de-role yourself, then nobody can get back in without hand-editing
    // the JSON). Block all self-targeted edits here, full stop.
    if (req.params.id === req.session.userId) {
        console.warn(`[ADMIN] ${req.session.username} attempted to edit their own account — blocked`);
        return res.status(400).json({ error: 'You cannot modify your own account via the Admin Dashboard. Ask another administrator to make changes to your account.' });
    }

    const { status, roleCode, clearance } = req.body || {};
    try {
        const updated = await userService.adminUpdate(req.params.id, { status, roleCode, clearance });
        if (!updated) return res.status(404).json({ error: 'User not found.' });
        // Status/role/clearance changed — force re-authentication so the
        // change takes effect immediately rather than at next natural expiry.
        destroyAllSessionsForUser(req.params.id);
        console.log(`[ADMIN] ${req.session.username} updated user ${updated.username}: ${JSON.stringify({ status, roleCode, clearance })}`);
        res.json(updated);
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
    }
}

async function resetPassword(req, res) {
    if (req.params.id === req.session.userId) {
        return res.status(400).json({ error: 'You cannot reset your own password here — use the standard change-password flow instead.' });
    }
    const result = await userService.adminResetPassword(req.params.id);
    if (!result) return res.status(404).json({ error: 'User not found.' });
    destroyAllSessionsForUser(req.params.id);
    console.log(`[ADMIN] ${req.session.username} reset password for user ${result.user.username}`);
    res.json(result);
}

async function deleteUser(req, res) {
    if (req.params.id === req.session.userId) {
        return res.status(400).json({ error: 'You cannot delete your own account while signed in as it.' });
    }
    const ok = await userService.deleteUser(req.params.id);
    if (!ok) return res.status(404).json({ error: 'User not found.' });
    destroyAllSessionsForUser(req.params.id);
    console.log(`[ADMIN] ${req.session.username} deleted user ${req.params.id}`);
    res.json({ deleted: true });
}

module.exports = { listUsers, updateUser, resetPassword, deleteUser };
