// 验证「本地缓存 + 后台校验」行为：切回看过的难度应当秒开，并只在数据过期时后台补一次请求。
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4173';
const DIR = 'docs/perf';
const wz = JSON.parse(fs.readFileSync(path.join(DIR, 'fixture-warzone-16.json'), 'utf8'));
const PIXEL = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const payloadFor = d => {
    const copy = JSON.parse(JSON.stringify(wz));
    copy.data.rankings[0].player.name = `D${d}·` + copy.data.rankings[0].player.name;
    return JSON.stringify(copy);
};

const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const reqs = [];
await page.route('https://assets.huaxu.app/**', r => r.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }));
await page.route('https://api.huaxu.app/**', async r => {
    const p = new URL(r.request().url()).pathname;
    reqs.push(p);
    await sleep(250);
    if (p.includes('/warzone/current/')) return r.fulfill({ status: 200, contentType: 'application/json', body: payloadFor(p.split('/').pop()) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
});
await page.route('**/api/visit', r => r.fulfill({ status: 200, body: '{"count":1}' }));

await page.goto(BASE + '/#/warzone', { waitUntil: 'load' });
await page.waitForSelector('.ranking-row', { state: 'attached', timeout: 30000 });
const hideFloating = () => page.addStyleTag({ content: '.ad-float,.corner-feedback{display:none!important}' });
await hideFloating();

const topName = () => page.evaluate(() => document.querySelector('.ranking-row .player-name')?.textContent || '');
const waitName = async (prefix, timeout = 5000) => {
    const t = Date.now();
    try {
        await page.waitForFunction(p => (document.querySelector('.ranking-row .player-name')?.textContent || '').startsWith(p), prefix, { timeout, polling: 16 });
        return Date.now() - t;
    } catch (e) {
        return -1;
    }
};

const results = [];
async function report(name, expectPrefix) {
    const ms = await waitName(expectPrefix);
    results.push({ name, prefix: expectPrefix, ms, requests: reqs.length });
    console.log(`${name.padEnd(30)} 上屏 ${ms}ms  当前请求数 ${reqs.length}`);
}

// 1) 首次切到英雄：必须走网络
reqs.length = 0;
await page.locator('.seg-btn', { hasText: '英雄' }).first().click();
await report('first-visit-英雄(15)', 'D15·');

// 2) 切回传奇：本次会话刚加载过 → 内存/持久缓存，应当 0 请求秒开
reqs.length = 0;
await page.locator('.seg-btn', { hasText: '传奇' }).first().click();
await report('back-传奇(16)-cached', 'D16·');
console.log(`  请求数 ${reqs.length}（应为 0）`);

// 3) 等 65s 让内存 60s TTL 过期，再切英雄：应当先秒开缓存，再后台补一次请求
console.log('等待 65s 让内存缓存过期…');
await sleep(65000);
reqs.length = 0;
const t3 = Date.now();
await page.locator('.seg-btn', { hasText: '英雄' }).first().click();
const visible = await waitName('D15·');
console.log(`stale-while-revalidate 英雄(15): 上屏 ${visible}ms（应有数据，不是骨架）`);
await sleep(1200);
console.log(`  后台请求 ${reqs.length} 个：${reqs.join(', ')}`);
results.push({ name: 'stale-revalidate-英雄', ms: visible, bgRequests: reqs.length, totalMs: Date.now() - t3 });

// 4) 手动刷新必须绕过缓存
reqs.length = 0;
await page.locator('.refresh-btn').click();
await sleep(1500);
console.log(`手动刷新触发请求 ${reqs.length} 个（应 ≥1）`);

// 5) 刷新页面后（sessionStorage 仍在）切英雄：应当同样 0 请求秒开
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('.ranking-row', { state: 'attached', timeout: 30000 });
await hideFloating();
await sleep(800);
reqs.length = 0;
await page.locator('.seg-btn', { hasText: '英雄' }).first().click();
const afterReload = await waitName('D15·');
const reqsAfterReload = reqs.length;
console.log(`刷新后切英雄(15): 上屏 ${afterReload}ms  请求 ${reqsAfterReload} 个`);
results.push({ name: 'after-reload-英雄', ms: afterReload, requests: reqsAfterReload });

fs.writeFileSync(path.join(DIR, 'cache-check.json'), JSON.stringify({ results, at: new Date().toISOString() }, null, 2));
await browser.close();
