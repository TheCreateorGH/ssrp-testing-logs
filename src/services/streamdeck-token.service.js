const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', '..', 'data', 'streamdeck_tokens.json');

function readTokens() {
    try {
        const value = JSON.parse(fs.readFileSync(FILE, 'utf8'));
        return Array.isArray(value) ? value : [];
    } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw error;
    }
}

function writeTokens(tokens) {
    fs.writeFileSync(FILE, `${JSON.stringify(tokens, null, 2)}\n`, 'utf8');
}

function hash(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function createToken(session, label = 'Stream Deck') {
    const token = `sd_${crypto.randomBytes(32).toString('hex')}`;
    const tokens = readTokens();
    tokens.push({
        tokenHash: hash(token),
        userId: session.userId,
        username: session.username,
        name: session.name,
        roleCode: session.roleCode,
        roleName: session.roleName,
        clearance: session.clearance,
        label: String(label).trim().slice(0, 80) || 'Stream Deck',
        createdAt: new Date().toISOString()
    });
    writeTokens(tokens);
    return token;
}

function getSession(token) {
    if (!token || !token.startsWith('sd_')) return null;
    const record = readTokens().find(item => item.tokenHash === hash(token));
    if (!record) return null;
    return {
        token,
        userId: record.userId,
        username: record.username,
        name: record.name,
        roleCode: record.roleCode,
        roleName: record.roleName,
        clearance: record.clearance,
        createdAt: record.createdAt,
        deviceToken: true
    };
}

function destroyToken(token) {
    const tokens = readTokens();
    const remaining = tokens.filter(item => item.tokenHash !== hash(token));
    if (remaining.length === tokens.length) return false;
    writeTokens(remaining);
    return true;
}

module.exports = { createToken, getSession, destroyToken };
