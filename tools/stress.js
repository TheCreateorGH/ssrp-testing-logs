const http = require('http');
const https = require('https');
const url = require('url');

function get(u) {
    return new Promise((resolve) => {
        const p = url.parse(u);
        const lib = p.protocol === 'https:' ? https : http;
        const req = lib.request(u, (res) => {
            let d = '';
            res.on('data', (c) => d += c);
            res.on('end', () => resolve({ status: res.statusCode, length: d.length }));
        });
        req.on('error', (err) => resolve({ error: String(err) }));
        req.end();
    });
}

async function run(urlToHit, total = 1000, concurrency = 100) {
    const results = [];
    let inFlight = 0;
    let started = 0;

    function next() {
        if (started >= total) return Promise.resolve();
        while (inFlight < concurrency && started < total) {
            started++;
            inFlight++;
            get(urlToHit).then((r) => {
                results.push(r);
                inFlight--;
            });
        }
        return new Promise((resolve) => {
            const iv = setInterval(() => {
                if (results.length >= total) {
                    clearInterval(iv);
                    resolve();
                } else if (inFlight === 0 && started >= total) {
                    clearInterval(iv);
                    resolve();
                }
            }, 50);
        });
    }

    await next();
    const ok = results.filter(r => r.status && r.status < 400).length;
    const errs = results.filter(r => r.error || (r.status && r.status >= 400)).length;
    const avgLen = results.filter(r => r.length).reduce((a, b) => a + b.length, 0) / (results.filter(r => r.length).length || 1);
    return { total, ok, errs, avgLen };
}

(async function () {
    const baseUrl = `http://${process.env.IP || process.env.HOST || '127.0.0.1'}:${process.env.PORT || 3000}`;
    const home = process.argv[2] || `${baseUrl}/`;
    const roles = process.argv[3] || `${baseUrl}/api/auth/roles`;
    const total = parseInt(process.argv[4] || '1000', 10);
    const concurrency = parseInt(process.argv[5] || '200', 10);

    console.log('Stress test:', { home, roles, total, concurrency });
    console.time('home');
    const h = await run(home, total, concurrency);
    console.timeEnd('home');
    console.log('home results', h);

    console.time('roles');
    const r = await run(roles, total, concurrency);
    console.timeEnd('roles');
    console.log('roles results', r);
})();
