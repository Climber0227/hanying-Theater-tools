// 端到端：构建产物在「同源 /api/huaxu」模式下能否正常取数（不依赖 Vercel，本地起一个小服务器）
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const DIST = 'dist-web';
const UP_PORT = 4741;
const APP_PORT = 4742;
const wz = JSON.parse(fs.readFileSync('docs/perf/fixture-warzone-16.json', 'utf8'));
const sleep = ms => new Promise(r => setTimeout(r, ms));

// 假上游：任何 /servers/** 都回 fixture（顶部玩家名带难度前缀，便于判断是否换了数据）
const upstream = http.createServer(async (req, res) => {
    const m = req.url.match(/\/warzone\/(?:current|\d+)\/(\d+)/);
    const payload = JSON.parse(JSON.stringify(wz));
    if (m) payload.data.rankings[0].player.name = `D${m[1]}·` + payload.data.rankings[0].player.name;
    await sleep(120);
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(payload));
});
await new Promise(r => upstream.listen(UP_PORT, '127.0.0.1', r));

process.env.HUAXU_UPSTREAM = `http://127.0.0.1:${UP_PORT}`;
process.env.HUAXU_TIMEOUT = '5000';
const { default: handler } = await import('../api/huaxu.js');

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.ico': 'image/x-icon', '.svg': 'image/svg+xml' };
const proxyHits = [];

const app = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/api/huaxu') {
        proxyHits.push(url.search);
        const query = Object.fromEntries(url.searchParams.entries());
        return handler({ method: 'GET', url: req.url, query }, res);
    }
    if (url.pathname === '/api/visit') {
        res.setHeader('content-type', 'application/json');
        return res.end('{"status":"success","count":1}');
    }
    let file = path.join(DIST, url.pathname === '/' ? 'index.html' : url.pathname);
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
    res.setHeader('content-type', MIME[path.extname(file)] || 'application/octet-stream');
    res.end(fs.readFileSync(file));
});
await new Promise(r => app.listen(APP_PORT, '127.0.0.1', r));

const results = [];
const check = (name, cond, detail = '') => {
    results.push({ name, pass: !!cond, detail });
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  → ' + detail : ''}`);
};

const browser = await chromium.launch({ channel: 'chrome' });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.route('https://assets.huaxu.app/**', r => r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') }));
await page.addInitScript(() => { globalThis.__HUAXU_FORCE_PROXY__ = true; });
await page.goto(`http://127.0.0.1:${APP_PORT}/#/warzone`, { waitUntil: 'load' });
await page.waitForFunction(() => document.querySelectorAll('.ranking-row').length >= 5, null, { timeout: 30000 });
await page.addStyleTag({ content: '.ad-float,.corner-feedback{display:none!important}' });

const name = () => page.evaluate(() => document.querySelector('.ranking-row .player-name')?.textContent || '');
check('榜单通过 /api/huaxu 取数', proxyHits.some(h => h.includes('warzone')), proxyHits[0]);
check('首行渲染', (await name()).startsWith('D16·'), await name());

// 切难度：应当再打一次 /api/huaxu（新 URL）
proxyHits.length = 0;
await page.locator('.seg-btn', { hasText: '英雄' }).first().click();
await page.waitForFunction(() => (document.querySelector('.ranking-row .player-name')?.textContent || '').startsWith('D15·'), null, { timeout: 15000 });
check('切难度走代理', proxyHits.length >= 1 && proxyHits[0].includes('15'), proxyHits.join(' | '));

// 手动刷新：应当带 nocache=1
proxyHits.length = 0;
await page.locator('.refresh-btn').click();
await sleep(1200);
check('手动刷新带 nocache=1', proxyHits.some(h => h.includes('nocache=1')), proxyHits.join(' | '));

check('无运行时异常', errors.length === 0, errors.join(' | '));

fs.writeFileSync('docs/perf/proxy-e2e.json', JSON.stringify({ results, proxyHits, errors }, null, 2));
await browser.close();
app.close();
upstream.close();
const failed = results.filter(x => !x.pass).length;
console.log(failed === 0 ? '\n全部通过' : `\n${failed} 项失败`);
process.exit(failed === 0 ? 0 : 1);
