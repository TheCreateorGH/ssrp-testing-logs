const userService = require('../services/user.service');
const { destroyAllSessionsForUser } = require('../services/session.service');

async function listUsers(req, res) {
    res.json(await userService.listUsers());
}

async function updateUser(req, res) {
    const { approved, roleCode, clearance } = req.body || {};
    try {
        const updated = await userService.adminUpdate(req.params.id, { approved, roleCode, clearance });
        if (!updated) return res.status(404).json({ error: 'User not found.' });
        // Role/clearance/approval changed — force re-authentication so the
        // change takes effect immediately rather than at next natural expiry.
        destroyAllSessionsForUser(req.params.id);
        res.json(updated);
    } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
    }
}

async function resetPassword(req, res) {
    const result = await userService.adminResetPassword(req.params.id);
    if (!result) return res.status(404).json({ error: 'User not found.' });
    destroyAllSessionsForUser(req.params.id);
    res.json(result);
}

async function deleteUser(req, res) {
    if (req.params.id === req.session.userId) {
        return res.status(400).json({ error: 'You cannot delete your own account while signed in as it.' });
    }
    const ok = await userService.deleteUser(req.params.id);
    if (!ok) return res.status(404).json({ error: 'User not found.' });
    destroyAllSessionsForUser(req.params.id);
    res.json({ deleted: true });
}

module.exports = { listUsers, updateUser, resetPassword, deleteUser };
