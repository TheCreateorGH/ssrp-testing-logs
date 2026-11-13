const userService = require('../services/user.service');
const { getRole } = require('../config/roles');

async function requireStreamDeckToken(req, res, next) {
    const token = req.headers['x-streamdeck-token'] ||
        (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const user = await userService.findByStreamDeckToken(token);

    if (!user || user.status !== 'ACTIVE' || !user.roleCode) {
        return res.status(401).json({ error: 'Invalid or inactive StreamDeck token.' });
    }

    const role = getRole(user.roleCode);
    req.session = {
        userId: user.id,
        username: user.username,
        name: user.displayName || user.username,
        roleCode: user.roleCode,
        roleName: role?.name || user.roleCode,
        clearance: user.clearance
    };
    req.user = user;
    next();
}

module.exports = { requireStreamDeckToken };
