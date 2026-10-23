// 使用场景基准：按真实网络延迟模拟「用户高频动作」，看请求数、可见延迟、掉帧。
// 用法：BASE_URL=http://127.0.0.1:4173 node scripts/perf-usage.mjs [tag]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4173';
const TAG = process.argv[2] || 'now';
const DIR = 'docs/perf';
const readJson = f => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
const wz = readJson('fixture-warzone-16.json');
const player = readJson('fixture-player.json');
const playerWz = readJson('fixture-player-warzone.json');
const PIXEL = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
);

const API_DELAY = Number(process.env.API_DELAY || 250);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// 每个难度返回一份「顶部玩家名带难度标记」的数据，便于测到「新数据何时上屏」
function payloadFor(d) {
    const copy = JSON.parse(JSON.stringify(wz));
    copy.data.rankings[0].player.name = `D${d}·` + copy.data.rankings[0].player.name;
    return JSON.stringify(copy);
}

const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();

const requests = [];
await page.route('https://assets.huaxu.app/**', r => r.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }));
await page.route('https://api.huaxu.app/**', async r => {
    const u = new URL(r.request().url());
    const p = u.pathname;
    const started = Date.now();
    requests.push({ url: p, at: started });
    await sleep(API_DELAY);
    const json = body => r.fulfill({ status: 200, contentType: 'application/json', body });
    if (p.includes('/warzone/current/')) {
        const d = p.split('/').pop();
        return json(payloadFor(d));
    }
    if (/\/players\/[^/]+\/warzone$/.test(p)) return json(JSON.stringify(playerWz));
    if (/\/players\/[^/]+$/.test(p)) return json(JSON.stringify(player));
    return json('{}');
});
await page.route('**/api/visit', r => r.fulfill({ status: 200, body: '{"count":1}' }));

await page.goto(BASE + '/#/warzone', { waitUntil: 'load' });
await page.waitForSelector('.ranking-row', { state: 'attached', timeout: 30000 });
await page.waitForTimeout(600);

const out = { tag: TAG, apiDelay: API_DELAY, scenarios: [], requests: [] };
const t0 = Date.now();

async function timeToMarker(marker, timeout = 8000) {
    const start = Date.now();
    await page.waitForFunction(
        m => {
            const el = document.querySelector('.ranking-row .player-name');
            return el && el.textContent.startsWith(m);
        },
        marker,
        { timeout, polling: 16 }
    );
    return Date.now() - start;
}

async function clickDiff(label) {
    await page.locator('.seg-btn', { hasText: label }).first().click();
}

// 1) 连点 5 个难度：每跳一次都是一个请求，看「上一次的渲染是否被白屏/骨架替换」
// 段名 -> 该段默认难度值
const SEG = [['英雄', '15'], ['领袖', '14'], ['尖兵', '12'], ['先锋', '9'], ['侦察', '6']];
for (const [label, d] of SEG) {
    const before = requests.length;
    const oldName = await page.evaluate(() => document.querySelector('.ranking-row .player-name')?.textContent || '');
    await clickDiff(label);
    const visible = await timeToMarker('D' + d + '·', 8000).catch(() => -1);
    out.scenarios.push({
        name: `switch-${label}`,
        reqs: requests.length - before,
        clickToNewDataMs: visible,
        oldRowKeptDuringLoad: !oldName.startsWith('D' + d + '·')
    });
    await page.waitForTimeout(300);
    console.log(`切换 ${label}(${d}): 请求 ${requests.length - before} 个, 新数据上屏 ${visible}ms`);
}

// 2) 切回刚看过的难度（60s 客户端缓存内）
const beforeWarm = requests.length;
const tWarm = Date.now();
await clickDiff('传奇');
const warm = await timeToMarker('D16·', 8000).catch(() => -1);
out.scenarios.push({ name: 'switch-back-warm', reqs: requests.length - beforeWarm, clickToNewDataMs: Date.now() - tWarm, dataMs: warm });
console.log(`切回传奇（缓存内）: 请求 ${requests.length - beforeWarm} 个, 用时 ${Date.now() - tWarm}ms`);

// 3) 手机端 + 4x CPU 降速：打字、滚动、冷开弹窗
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const mp = await mctx.newPage();
await mp.route('https://assets.huaxu.app/**', r => r.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }));
await mp.route('https://api.huaxu.app/**', async r => {
    const p = new URL(r.request().url()).pathname;
    await sleep(API_DELAY);
    if (p.includes('/warzone/current/')) return r.fulfill({ status: 200, contentType: 'application/json', body: payloadFor(p.split('/').pop()) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
});
await mp.route('**/api/visit', r => r.fulfill({ status: 200, body: '{"count":1}' }));
await mp.addInitScript(() => {
    window.__long = [];
    window.__frames = [];
    new PerformanceObserver(l => { for (const e of l.getEntries()) window.__long.push({ s: e.startTime, d: e.duration }); }).observe({ entryTypes: ['longtask'] });
    const loop = t => { window.__frames.push(t); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
});
const cdp = await mctx.newCDPSession(mp);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

await mp.bringToFront();
const mStart = Date.now();
await mp.goto(BASE + '/#/warzone', { waitUntil: 'load' });
await mp.waitForSelector('.ranking-row', { state: 'attached', timeout: 60000 });
await mp.waitForTimeout(1500);
console.log(`手机 4x CPU 首屏可交互: ${Date.now() - mStart}ms`);

async function mMeasure(name, fn, settle = 500) {
    await mp.bringToFront();
    await mp.evaluate(() => { window.__long.length = 0; window.__frames.length = 0; });
    const t = Date.now();
    await fn();
    await mp.waitForTimeout(settle);
    const d = await mp.evaluate(() => ({
        long: window.__long.slice(),
        frames: window.__frames.slice(1).map((x, i, a) => x - a[i]).filter(v => v > 0 && v < 3000)
    }));
    const s = d.frames.sort((a, b) => a - b);
    const p95 = s.length ? s[Math.floor(s.length * 0.95)] : 0;
    const sc = { name, wallMs: Date.now() - t, longTasks: d.long.length, longTaskMs: Math.round(d.long.reduce((a, e) => a + e.d, 0)), frameP95: +p95.toFixed(1), jank: d.frames.filter(v => v > 50).length };
    out.scenarios.push(sc);
    console.log(`  ${name}: ${sc.wallMs}ms 长任务 ${sc.longTasks}个/${sc.longTaskMs}ms frameP95 ${sc.frameP95}ms`);
    return sc;
}

const mSearch = mp.locator('.ranking-search input');
await mSearch.click();
await mMeasure('m-type-8-keys', async () => { await mSearch.type('27826672', { delay: 90 }); }, 800);

await mSearch.fill('');
await mMeasure('m-scroll-15', async () => {
    for (let i = 0; i < 15; i++) { await mp.mouse.wheel(0, 260); await mp.waitForTimeout(60); }
    await mp.mouse.wheel(0, -4000);
}, 600);

await mMeasure('m-open-bracket', async () => {
    await mp.locator('.tool-btn').first().click();
    await mp.waitForSelector('.modal-content', { timeout: 30000 });
}, 800);

// 桌面端页面切换：看懒加载 chunk 的代价
const pageSwits = [];
for (const label of ['玩家查询', '幻痛囚笼', '我的', '战区数据']) {
    const before = requests.length;
    const t = Date.now();
    const resp = [];
    const onResp = r => resp.push(r.url());
    page.on('response', onResp);
    await page.locator('.nav-btn', { hasText: label }).click();
    await page.waitForTimeout(1200);
    page.off('response', onResp);
    const chunks = resp.filter(u => u.includes('/assets/') && u.endsWith('.js')).map(u => u.split('/').pop());
    pageSwits.push({ label, wallMs: Date.now() - t, apiReqs: requests.length - before, chunks });
    console.log(`切页 ${label}: ${Date.now() - t}ms 新 chunk ${chunks.join(',') || '无'}`);
}
out.scenarios.push({ name: 'page-switch', pageSwits });

out.totalMs = Date.now() - t0;
out.requests = requests.map(r => r.url.replace('/servers/cn', ''));
fs.writeFileSync(path.join(DIR, `usage-${TAG}.json`), JSON.stringify(out, null, 2));
console.log(`\n-> docs/perf/usage-${TAG}.json  总耗时 ${out.totalMs}ms`);
await browser.close();
