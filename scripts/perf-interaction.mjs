// 交互性能基准：测量「日常高频操作」的输入延迟、长任务、掉帧。
// 用法：BASE_URL=http://127.0.0.1:4173 node scripts/perf-interaction.mjs [tag]
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
// 1x1 透明 PNG：把 CDN 图片换成常量，避免本机 CDN 卡死导致测量抖动
const PIXEL = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
);

const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();

await page.route('https://assets.huaxu.app/**', r => r.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }));
await page.route('https://api.huaxu.app/**', async r => {
    const p = new URL(r.request().url()).pathname;
    const json = body => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (p.includes('/warzone/current')) return json(wz);
    if (/\/players\/[^/]+\/warzone$/.test(p)) return json(playerWz);
    if (/\/players\/[^/]+$/.test(p)) return json(player);
    return json({});
});
await page.route('**/api/visit', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"count":1}' }));
await page.route('**/api/trends**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"data":[]}' }));

await page.addInitScript(() => {
    const perf = (window.__perf = { longtasks: [], events: [], frames: [], mutations: 0 });
    try {
        new PerformanceObserver(l => {
            for (const e of l.getEntries()) perf.longtasks.push({ start: e.startTime, dur: e.duration });
        }).observe({ entryTypes: ['longtask'] });
        new PerformanceObserver(l => {
            for (const e of l.getEntries()) {
                perf.events.push({ name: e.name, start: e.startTime, dur: e.duration, input: e.processingStart - e.startTime });
            }
        }).observe({ type: 'event', durationThreshold: 16, buffered: true });
    } catch (err) {}
    const loop = t => { perf.frames.push(t); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
});

const results = [];
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push(String(e)));

function stats(nums) {
    if (!nums.length) return null;
    const s = [...nums].sort((a, b) => a - b);
    const at = q => s[Math.min(s.length - 1, Math.floor(q * s.length))];
    return { n: s.length, p50: +at(0.5).toFixed(1), p95: +at(0.95).toFixed(1), max: +s[s.length - 1].toFixed(1) };
}

async function step(name, fn, { settle = 250 } = {}) {
    await page.evaluate(() => {
        const p = window.__perf;
        p.lt0 = p.longtasks.length; p.ev0 = p.events.length; p.frames.length = 0;
    });
    await fn();
    await page.waitForTimeout(settle);
    const d = await page.evaluate(() => {
        const p = window.__perf;
        return { lt: p.longtasks.slice(p.lt0), ev: p.events.slice(p.ev0), frames: p.frames.slice() };
    });
    const deltas = d.frames.slice(1).map((t, i) => t - d.frames[i]).filter(x => x > 0 && x < 2000);
    const row = {
        name,
        longTasks: d.lt.length,
        longTaskMs: +d.lt.reduce((a, e) => a + e.dur, 0).toFixed(0),
        longestTask: +Math.max(0, ...d.lt.map(e => e.dur)).toFixed(1),
        events: d.ev.length,
        inputDelay: stats(d.ev.map(e => e.input)),
        eventDur: stats(d.ev.map(e => e.dur)),
        frame: stats(deltas),
        jankFrames: deltas.filter(x => x > 32).length
    };
    results.push(row);
    console.log(
        `${name.padEnd(22)} longtask=${String(row.longTasks).padStart(2)}/${String(row.longTaskMs).padStart(5)}ms` +
        ` ev=${String(row.events).padStart(2)} dur.p95=${row.eventDur ? row.eventDur.p95 : '-'}ms` +
        ` frame.p95=${row.frame ? row.frame.p95 : '-'}ms jank=${row.jankFrames}`
    );
    return row;
}

const t = Date.now();
await page.goto(BASE + '/#/warzone', { waitUntil: 'load' });
await page.waitForSelector('.ranking-row', { state: 'attached', timeout: 30000 });
await page.waitForTimeout(1200);
const loadMs = Date.now() - t;

const nav = await page.evaluate(() => {
    const n = performance.getEntriesByType('navigation')[0];
    const paints = performance.getEntriesByType('paint');
    const lcp = performance.getEntriesByType('largest-contentful-paint').pop();
    return {
        domContentLoaded: Math.round(n.domContentLoadedEventEnd),
        load: Math.round(n.loadEventEnd),
        fcp: Math.round((paints.find(p => p.name === 'first-contentful-paint') || {}).startTime || 0),
        lcp: lcp ? Math.round(lcp.startTime) : null,
        nodes: document.querySelectorAll('*').length,
        domInteractive: Math.round(n.domInteractive)
    };
});
console.log(`首屏：load=${loadMs}ms domInteractive=${nav.domInteractive} FCP=${nav.fcp} LCP=${nav.lcp} nodes=${nav.nodes}`);

await step('idle-4s', () => page.waitForTimeout(4000), { settle: 0 });

const search = page.locator('.ranking-search input');
await search.click();
await step('type-10-keys', async () => {
    await search.type('27826672', { delay: 40 });
}, { settle: 500 });

await step('clear-search', async () => {
    await search.fill('');
    await search.press('Backspace');
}, { settle: 400 });

await step('sort-total', async () => {
    await page.locator('.ranking-header .col-sort').last().click();
}, { settle: 400 });

await step('scroll-20-steps', async () => {
    for (let i = 0; i < 20; i++) {
        await page.mouse.wheel(0, 320);
        await page.waitForTimeout(40);
    }
    await page.mouse.wheel(0, -6400);
}, { settle: 400 });

await step('switch-difficulty', async () => {
    await page.locator('.seg-btn').nth(1).click();
    await page.waitForTimeout(600);
    await page.waitForSelector('.ranking-row', { state: 'attached' });
}, { settle: 600 });

await step('open-bracket-cold', async () => {
    await page.locator('.tool-btn').first().click();
    await page.waitForSelector('.modal-content', { timeout: 20000 });
}, { settle: 500 });

await step('close-bracket', async () => {
    await page.locator('.modal-close').first().click();
}, { settle: 300 });

await step('open-bracket-warm', async () => {
    await page.locator('.tool-btn').first().click();
    await page.waitForSelector('.modal-content', { timeout: 20000 });
}, { settle: 400 });

await step('close-bracket-2', async () => {
    await page.locator('.modal-close').first().click();
}, { settle: 300 });

await step('open-filter-panel', async () => {
    await page.locator('.filter-btn').click();
    await page.waitForSelector('.filter-pop', { timeout: 5000 });
}, { settle: 300 });

await step('pick-char-filter', async () => {
    const sel = page.locator('.filter-pop .char-slot-select').first();
    await sel.selectOption('6');
}, { settle: 400 });

await step('open-trend', async () => {
    await page.locator('.zone-actions .zone-sa-btn').first().click({ force: true });
    await page.waitForSelector('.modal-content', { timeout: 20000 });
}, { settle: 500 });

// 手机端：滚动一屏的帧率
const mobile = await ctx.newPage();
await mobile.setViewportSize({ width: 390, height: 844 });
await mobile.route('https://assets.huaxu.app/**', r => r.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }));
await mobile.route('https://api.huaxu.app/**', async r => {
    const p = new URL(r.request().url()).pathname;
    const json = body => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (p.includes('/warzone/current')) return json(wz);
    return json({});
});
await mobile.route('**/api/visit', r => r.fulfill({ status: 200, body: '{"count":1}' }));
await mobile.addInitScript(() => {
    window.__frames = [];
    const loop = t => { window.__frames.push(t); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
});
await mobile.goto(BASE + '/#/warzone', { waitUntil: 'load' });
await mobile.waitForSelector('.ranking-row', { state: 'attached', timeout: 30000 });
await mobile.waitForTimeout(1000);
await mobile.evaluate(() => { window.__frames.length = 0; });
for (let i = 0; i < 20; i++) {
    await mobile.mouse.wheel(0, 240);
    await mobile.waitForTimeout(40);
}
const mFrames = await mobile.evaluate(() => window.__frames.slice(1).map((t, i, a) => t - a[i]).filter(x => x > 0 && x < 2000));
const mRow = { name: 'mobile-scroll', frame: stats(mFrames), jankFrames: mFrames.filter(x => x > 32).length };
results.push(mRow);
console.log(`mobile-scroll          frame.p95=${mRow.frame ? mRow.frame.p95 : '-'}ms jank=${mRow.jankFrames} n=${mFrames.length}`);

const out = { tag: TAG, base: BASE, built: new Date().toISOString(), loadMs, nav, steps: results, consoleErrors };
fs.writeFileSync(path.join(DIR, `interaction-${TAG}.json`), JSON.stringify(out, null, 2));
console.log(`\n-> docs/perf/interaction-${TAG}.json  控制台错误 ${consoleErrors.length}`);
await browser.close();
