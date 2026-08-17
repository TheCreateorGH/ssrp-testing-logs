const http = require('http');
const { URL } = require('url');

function request({ method='GET', url, headers={}, body=null }) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const opts = { method, hostname: u.hostname, port: u.port, path: u.pathname + (u.search||''), headers };
    const req = http.request(opts, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(d); } catch {}
        resolve({ status: res.statusCode, body: parsed || d });
      });
    });
    req.on('error', (err) => resolve({ error: String(err) }));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function login(base, username, password) {
  const r = await request({ method: 'POST', url: `${base}/api/auth/login`, headers: { 'Content-Type':'application/json' }, body: { username, password } });
  if (r.status === 201 && r.body && r.body.token) return r.body.token;
  throw new Error('Login failed: ' + JSON.stringify(r));
}

async function run() {
  const base = process.argv[2] || 'http://localhost:3000';
  const username = process.argv[3] || 'loadtest';
  const password = process.argv[4] || 'TestPass123';
  const total = parseInt(process.argv[5] || '200', 10);
  const concurrency = parseInt(process.argv[6] || '50', 10);

  console.log('Logging in...');
  const token = await login(base, username, password);
  console.log('Token received');

  const createdIds = [];

  // Create logs in batches
  for (let b = 0; b < Math.ceil(total / concurrency); b++) {
    const batch = Math.min(concurrency, total - b * concurrency);
    console.log(`Create batch ${b+1} (${batch})`);
    const promises = [];
    for (let i = 0; i < batch; i++) {
      const payload = { scp: `SCP-${Math.floor(Math.random()*9999)}`, viewClearance: 0, notes: 'load test' };
      promises.push(request({ method:'POST', url: `${base}/api/logs`, headers: { 'Content-Type':'application/json', 'X-Session-Token': token }, body: payload }));
    }
    const res = await Promise.all(promises);
    res.forEach(r => { if (r.status === 201 && r.body && r.body.id) createdIds.push(r.body.id); else console.log('Create fail', r); });
  }

  console.log('Created', createdIds.length, 'logs');

  // Update half
  const toUpdate = createdIds.slice(0, Math.floor(createdIds.length/2));
  for (let id of toUpdate) {
    const res = await request({ method:'PUT', url: `${base}/api/logs/${id}`, headers: { 'Content-Type':'application/json', 'X-Session-Token': token }, body: { notes: 'updated by load test' } });
    if (res.status >= 400) console.log('Update fail', id, res);
  }

  // Read all
  const list = await request({ method:'GET', url: `${base}/api/logs`, headers: { 'X-Session-Token': token } });
  console.log('List status', list.status, 'items', Array.isArray(list.body) ? list.body.length : 'N/A');

  // Delete half
  const toDelete = createdIds.slice(Math.floor(createdIds.length/2));
  for (let id of toDelete) {
    const res = await request({ method:'DELETE', url: `${base}/api/logs/${id}`, headers: { 'X-Session-Token': token } });
    if (res.status >= 400) console.log('Delete fail', id, res);
  }

  console.log('Done');
}

run().catch(err => { console.error(err); process.exit(1); });
