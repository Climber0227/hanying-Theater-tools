// api/huaxu.js 的行为验收：白名单、缓存头、超时兜底、源站错误兜底、4xx 透传
// 用法：node scripts/test-api-proxy.mjs        （mock 上游，快）
//      REAL=1 node scripts/test-api-proxy.mjs  （额外打一次真实源站，验证透传）
import http from 'node:http';
import fs from 'node:fs';

const wz = JSON.parse(fs.readFileSync('docs/perf/fixture-warzone-16.json', 'utf8'));
const UPSTREAM_PORT = 4731;
const PROXY_PORT = 4732;

// ---------- 可控的假上游 ----------
const ctl = { delay: 30, status: 200, type: 'application/json; charset=utf-8', body: JSON.stringify(wz), hits: 0, lastUrl: '' };
const upstream = http.createServer((req, res) => {
    ctl.hits++;
    ctl.lastUrl = req.url;
    setTimeout(() => {
        res.statusCode = ctl.status;
        res.setHeader('content-type', ctl.type);
        res.end(ctl.body);
    }, ctl.delay);
});
await new Promise(r => upstream.listen(UPSTREAM_PORT, '127.0.0.1', r));

// ---------- Vercel handler 的最小 req/res 适配 ----------
process.env.HUAXU_UPSTREAM = `http://127.0.0.1:${UPSTREAM_PORT}`;
process.env.HUAXU_TIMEOUT = '600';
const { default: handler } = await import('../api/huaxu.js');

function callProxy(query) {
    return new Promise((resolve, reject) => {
        const req = { method: 'GET', url: '/api/huaxu', query };
        const res = {
            statusCode: 200,
            headers: {},
            setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
            status(c) { this.statusCode = c; return this; },
            send(b) { resolve({ status: this.statusCode, headers: this.headers, body: b }); return this; },
            json(o) { this.headers['content-type'] = 'application/json'; resolve({ status: this.statusCode, headers: this.headers, body: JSON.stringify(o) }); return this; },
            end(b) { resolve({ status: this.statusCode, headers: this.headers, body: b || '' }); return this; }
        };
        Promise.resolve(handler(req, res)).catch(reject);
        setTimeout(() => reject(new Error('proxy call timeout')), 15000);
    });
}

const results = [];
const check = (name, cond, detail = '') => {
    results.push({ name, pass: !!cond, detail });
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  → ' + detail : ''}`);
};

// 1) 正常透传 + 缓存头
let r = await callProxy({ path: '/servers/cn/warzone/current/16' });
check('200 透传', r.status === 200 && r.body.includes('"warzone"'), `status=${r.status} bytes=${r.body.length}`);
check('Cache-Control 含 s-maxage=60', /s-maxage=60/.test(r.headers['cache-control'] || ''), r.headers['cache-control']);
check('同时给 CDN-Cache-Control', /s-maxage=60/.test(r.headers['cdn-cache-control'] || ''), r.headers['cdn-cache-control']);
check('X-Data-State=fresh', r.headers['x-data-state'] === 'fresh', r.headers['x-data-state']);

// 2) 白名单
r = await callProxy({ path: '/etc/passwd' });
check('任意路径被拒', r.status === 400, `status=${r.status}`);
r = await callProxy({ path: '/servers/cn/warzone/current/99' });
check('非法难度被拒', r.status === 400, `status=${r.status}`);
r = await callProxy({ path: '/servers/cn//players/1' });
check('双斜杠被拒', r.status === 400, `status=${r.status}`);

// 3) 查询串透传（ppc 的 ranking=true）
ctl.lastUrl = '';
r = await callProxy({ path: '/servers/cn/ppc/current/4', q: 'ranking=true' });
check('query 透传', ctl.lastUrl === '/servers/cn/ppc/current/4?ranking=true', ctl.lastUrl);
check('ppc TTL=60', /s-maxage=60/.test(r.headers['cache-control'] || ''), r.headers['cache-control']);

// 4) 玩家历届战绩：TTL 300
r = await callProxy({ path: '/servers/cn/players/27826672/warzone' });
check('历史战绩 TTL=300', /s-maxage=300/.test(r.headers['cache-control'] || ''), r.headers['cache-control']);

// 5) 源站 4xx 原样透传且不缓存
ctl.status = 404;
r = await callProxy({ path: '/servers/cn/players/1' });
check('4xx 透传状态码', r.status === 404, `status=${r.status}`);
check('4xx 不缓存', r.headers['cache-control'] === 'no-store', r.headers['cache-control']);

// 6) 源站 5xx → 用快照兜底（上一步已成功缓存过 /warzone/current/16）
ctl.status = 500;
r = await callProxy({ path: '/servers/cn/warzone/current/16' });
check('5xx 时返回快照', r.status === 200 && r.headers['x-data-state'] === 'stale', `status=${r.status} state=${r.headers['x-data-state']}`);
check('快照命中的数据完整', r.body.includes('"warzone"'));

// 7) 没有快照 + 源站挂 → 504
r = await callProxy({ path: '/servers/cn/warzone/current/15' });
check('无快照时返回 504', r.status === 504, `status=${r.status}`);

// 8) 超时兜底（源站 3s，代理 600ms 超时）
ctl.status = 200;
ctl.delay = 3000;
const t0 = Date.now();
r = await callProxy({ path: '/servers/cn/warzone/current/13' });
const elapsed = Date.now() - t0;
check('慢源站按超时返回', r.status === 504 && elapsed < 2000, `${elapsed}ms status=${r.status}`);
ctl.delay = 30;

// 9) nocache=1 时不缓存
r = await callProxy({ path: '/servers/cn/warzone/current/16', nocache: '1' });
check('nocache 返回 no-store', r.headers['cache-control'] === 'no-store', r.headers['cache-control']);

// 10) 源站被 Cloudflare 挑战（403 + HTML）：不能把验证页当数据，要标记代理不可用
ctl.status = 403;
ctl.type = 'text/html; charset=UTF-8';
ctl.body = '<!DOCTYPE html><html><head><title>Just a moment...</title></head><body>cf</body></html>';
r = await callProxy({ path: '/servers/cn/warzone/current/16' });
check('挑战页不当作数据透传', r.status === 502, );
check('挑战页标记 X-Proxy-Usable=0', r.headers['x-proxy-usable'] === '0', r.headers['x-proxy-usable']);
check('挑战页不缓存', r.headers['cache-control'] === 'no-store', r.headers['cache-control']);
ctl.status = 200;
ctl.type = 'application/json; charset=utf-8';
ctl.body = JSON.stringify(wz);

// 10) 真实源站透传（可选）
if (process.env.REAL === '1') {
    process.env.HUAXU_UPSTREAM = 'https://api.huaxu.app';
    process.env.HUAXU_TIMEOUT = '15000';
    const { default: realHandler } = await import('../api/huaxu.js?real=1');
    const t = Date.now();
    const real = await new Promise((resolve, reject) => {
        const req = { method: 'GET', url: '/', query: { path: '/servers/cn/warzone/current/16' } };
        const res = {
            statusCode: 200, headers: {},
            setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
            status(c) { this.statusCode = c; return this; },
            send(b) { resolve({ status: this.statusCode, headers: this.headers, body: b }); return this; },
            json(o) { resolve({ status: this.statusCode, headers: this.headers, body: JSON.stringify(o) }); return this; },
            end(b) { resolve({ status: this.statusCode, headers: this.headers, body: b || '' }); return this; }
        };
        Promise.resolve(realHandler(req, res)).catch(reject);
        setTimeout(() => reject(new Error('real call timeout')), 30000);
    });
    console.log(`真实源站：${Date.now() - t}ms  ${real.status}  ${real.body.length} bytes  state=${real.headers['x-data-state']}`);
    check('真实源站可用', real.status === 200 && real.body.length > 1000, `${real.body.length} bytes`);
}

fs.writeFileSync('docs/perf/proxy-test.json', JSON.stringify({ results, at: new Date().toISOString() }, null, 2));
upstream.close();
const failed = results.filter(x => !x.pass).length;
console.log(failed === 0 ? '\n全部通过' : `\n${failed} 项失败`);
process.exit(failed === 0 ? 0 : 1);
