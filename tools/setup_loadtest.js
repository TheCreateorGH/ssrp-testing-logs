const fs = require('fs').promises;
const path = require('path');
const { hashPassword } = require('../src/utils/password');
const { DATA_DIR } = require('../src/config/paths');

const USERS_FILE = path.join(DATA_DIR, 'users.json');

async function readAll() {
  try { return JSON.parse(await fs.readFile(USERS_FILE, 'utf8')); } catch { return []; }
}

async function writeAll(users) { await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2), 'utf8'); }

(async function(){
  const username = process.argv[2] || 'loadtest';
  const password = process.argv[3] || 'TestPass123';
  const users = await readAll();
  let user = users.find(u => u.username === username);
  if (!user) {
    user = {
      id: require('uuid').v4(),
      username,
      passwordHash: hashPassword(password),
      displayName: 'Load Test',
      roleCode: 'ADMIN',
      clearance: 6,
      approved: true,
      mustChangePassword: false,
      createdAt: new Date().toISOString()
    };
    users.push(user);
    console.log('Created user', username);
  } else {
    user.passwordHash = hashPassword(password);
    user.roleCode = 'ADMIN';
    user.clearance = 6;
    user.approved = true;
    user.mustChangePassword = false;
    console.log('Updated user', username);
  }
  await writeAll(users);
  console.log('Wrote', USERS_FILE);
})();
