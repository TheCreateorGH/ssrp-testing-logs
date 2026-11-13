const http = require('http');
const https = require('https');
const { URL } = require('url');

function get(u) {
    return new Promise((resolve) => {
        const url = new URL(u);
        const lib = url.protocol === 'https:' ? https : http;
        const opts = { hostname: url.hostname, port: url.port, path: url.pathname + (url.search || ''), method: 'GET' };
        const req = lib.request(opts, (res) => {
            let d = '';
            res.on('data', (c) => d += c);
            res.on('end', () => resolve({ status: res.statusCode, length: d.length }));
        });
        req.on('error', (err) => resolve({ error: String(err) }));
        req.end();
    });
}

async function runBatch(url, count) {
    const arr = new Array(count).fill(0).map(() => get(url));
    return Promise.all(arr);
}

async function run(urlToHit, total = 1000, concurrency = 100) {
    const results = [];
    const batches = Math.ceil(total / concurrency);
    for (let i = 0; i < batches; i++) {
        const toRun = Math.min(concurrency, total - i * concurrency);
        // eslint-disable-next-line no-console
        console.log(`Starting batch ${i + 1}/${batches} (${toRun} requests)`);
        const batchRes = await runBatch(urlToHit, toRun);
        results.push(...batchRes);
    }
    return results;
}

(async function () {
    const baseUrl = `http://${process.env.IP || process.env.HOST || '127.0.0.1'}:${process.env.PORT || 3000}`;
    const home = process.argv[2] || `${baseUrl}/`;
    const roles = process.argv[3] || `${baseUrl}/api/auth/roles`;
    const total = parseInt(process.argv[4] || '1000', 10);
    const concurrency = parseInt(process.argv[5] || '200', 10);

    console.log('Stress test starting:', { home, roles, total, concurrency });

    console.time('home');
    const hres = await run(home, total, concurrency);
    console.timeEnd('home');
    const hok = hres.filter(r => r.status && r.status < 400).length;
    const herr = hres.filter(r => r.error || (r.status && r.status >= 400)).length;
    const havgLen = hres.filter(r => r.length).reduce((a, b) => a + b, 0) / (hres.filter(r => r.length).length || 1);
    console.log('home results', { total: hres.length, ok: hok, errs: herr, avgLen: Math.round(havgLen) });

    console.time('roles');
    const rres = await run(roles, total, concurrency);
    console.timeEnd('roles');
    const rok = rres.filter(r => r.status && r.status < 400).length;
    const rerr = rres.filter(r => r.error || (r.status && r.status >= 400)).length;
    const ravgLen = rres.filter(r => r.length).reduce((a, b) => a + b, 0) / (rres.filter(r => r.length).length || 1);
    console.log('roles results', { total: rres.length, ok: rok, errs: rerr, avgLen: Math.round(ravgLen) });

    // summary
    console.log('SUMMARY');
    console.log('home ok/errs', hok, herr);
    console.log('roles ok/errs', rok, rerr);
})();
