const crypto = require('crypto');

/** Hashes a password with a random salt. Returns "salt:hash" (both hex). */
function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
    return `${salt}:${hash}`;
}

/** Verifies a password against a "salt:hash" string produced by hashPassword(). */
function verifyPassword(password, stored) {
    if (!stored || !stored.includes(':')) return false;
    const [salt, hash] = stored.split(':');
    const candidate = crypto.scryptSync(String(password), salt, 64).toString('hex');
    const a = Buffer.from(hash, 'hex');
    const b = Buffer.from(candidate, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

/** Generates a random human-typeable temporary password for resets. */
function generateTempPassword() {
    return crypto.randomBytes(6).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10) || 'Temp1234';
}

module.exports = { hashPassword, verifyPassword, generateTempPassword };
