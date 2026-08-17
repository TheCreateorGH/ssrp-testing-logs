const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { DATA_DIR } = require('../config/paths');
const { hashPassword, verifyPassword, generateTempPassword } = require('../utils/password');
const { getRole } = require('../config/roles');

const USERS_FILE = path.join(DATA_DIR, 'users.json');

async function readAll() {
    try {
        return JSON.parse(await fs.readFile(USERS_FILE, 'utf8'));
    } catch {
        return [];
    }
}

async function writeAll(users) {
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}

/** Strips the password hash before anything leaves the service layer. */
function toPublic(user) {
    if (!user) return null;
    const { passwordHash, ...pub } = user; // eslint-disable-line no-unused-vars
    return pub;
}

/** Creates the initial ADMIN account on first boot so there's a way in.
 *  Logged loudly to the console since it's a real (if temporary) credential. */
async function ensureBootstrapAdmin() {
    const users = await readAll();
    if (users.length) return;
    const tempPassword = generateTempPassword();
    users.push({
        id: uuidv4(),
        username: 'admin',
        passwordHash: hashPassword(tempPassword),
        displayName: 'System Administrator',
        roleCode: 'ADMIN',
        clearance: 6,
        approved: true,
        mustChangePassword: true,
        createdAt: new Date().toISOString()
    });
    await writeAll(users);
    console.log(`
╔════════════════════════════════════════════════════╗
║  ☣  BOOTSTRAP ADMIN ACCOUNT CREATED                 ║
║  username: admin                                     ║
║  password: ${tempPassword.padEnd(40)}║
║  You will be required to change this on first login. ║
╚════════════════════════════════════════════════════╝
`);
}

async function findByUsername(username) {
    const users = await readAll();
    return users.find(u => u.username.toLowerCase() === String(username || '').toLowerCase()) || null;
}

async function findById(id) {
    const users = await readAll();
    return users.find(u => u.id === id) || null;
}

async function listUsers() {
    const users = await readAll();
    return users.map(toPublic);
}

async function register({ username, password, displayName }) {
    const users = await readAll();
    if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
        throw Object.assign(new Error('That username is already taken.'), { status: 409 });
    }
    const user = {
        id: uuidv4(),
        username: String(username).trim(),
        passwordHash: hashPassword(password),
        displayName: (displayName || username).trim(),
        roleCode: null,
        clearance: 0,
        approved: false,
        mustChangePassword: false,
        createdAt: new Date().toISOString()
    };
    users.push(user);
    await writeAll(users);
    return toPublic(user);
}

/** Full account gate: exists, password matches, admin-approved, and has
 *  a role assigned. Any failure returns a specific reason for the UI. */
async function authenticate(username, password) {
    const user = await findByUsername(username);
    if (!user || !verifyPassword(password, user.passwordHash)) {
        throw Object.assign(new Error('Invalid username or password.'), { status: 401 });
    }
    if (!user.approved) {
        throw Object.assign(new Error('Your account is awaiting administrator approval.'), { status: 403, reason: 'PENDING_APPROVAL' });
    }
    if (!user.roleCode) {
        throw Object.assign(new Error('Your account has not been assigned a Foundation role yet.'), { status: 403, reason: 'PENDING_ROLE' });
    }
    return user;
}

async function changePassword(id, oldPassword, newPassword) {
    const users = await readAll();
    const user = users.find(u => u.id === id);
    if (!user) throw Object.assign(new Error('User not found.'), { status: 404 });
    if (!verifyPassword(oldPassword, user.passwordHash)) {
        throw Object.assign(new Error('Current password is incorrect.'), { status: 401 });
    }
    user.passwordHash = hashPassword(newPassword);
    user.mustChangePassword = false;
    await writeAll(users);
    return toPublic(user);
}

async function adminUpdate(id, { approved, roleCode, clearance }) {
    const users = await readAll();
    const user = users.find(u => u.id === id);
    if (!user) return null;
    if (typeof approved === 'boolean') user.approved = approved;
    if (roleCode !== undefined) {
        if (roleCode !== null && !getRole(roleCode)) throw Object.assign(new Error('Unknown role.'), { status: 400 });
        user.roleCode = roleCode;
        // Clearance always follows the assigned role unless explicitly overridden below.
        if (roleCode) user.clearance = getRole(roleCode).clearance;
    }
    if (Number.isInteger(clearance)) user.clearance = Math.min(6, Math.max(0, clearance));
    await writeAll(users);
    return toPublic(user);
}

async function adminResetPassword(id) {
    const users = await readAll();
    const user = users.find(u => u.id === id);
    if (!user) return null;
    const tempPassword = generateTempPassword();
    user.passwordHash = hashPassword(tempPassword);
    user.mustChangePassword = true;
    await writeAll(users);
    return { user: toPublic(user), tempPassword };
}

async function deleteUser(id) {
    const users = await readAll();
    const next = users.filter(u => u.id !== id);
    if (next.length === users.length) return false;
    await writeAll(next);
    return true;
}

module.exports = {
    ensureBootstrapAdmin, listUsers, findByUsername, findById,
    register, authenticate, changePassword,
    adminUpdate, adminResetPassword, deleteUser, toPublic
};
