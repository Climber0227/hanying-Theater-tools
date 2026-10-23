// 键盘/点击的「每次输入成本」基准：4x CPU 降速模拟中端手机，用 Event Timing 取真实处理耗时。
// 用法：BASE_URL=http://127.0.0.1:4173 node scripts/perf-typing.mjs [tag]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4173';
const TAG = process.argv[2] || 'now';
const DIR = 'docs/perf';
const readJson = f => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
const wz = readJson('fixture-warzone-16.json');
const PIXEL = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
);

const browser = await chromium.launch({ channel: 'chrome' });
const out = { tag: TAG, builtAt: new Date().toISOString(), scenarios: [] };

async function run(viewport, cpuRate, label) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: viewport.width < 600, hasTouch: viewport.width < 600 });
    const page = await ctx.newPage();
    await page.route('https://assets.huaxu.app/**', r => r.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }));
    await page.route('https://api.huaxu.app/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(wz) }));
    await page.route('**/api/visit', r => r.fulfill({ status: 200, body: '{"count":1}' }));
    await page.addInitScript(() => {
        const p = (window.__ev = { events: [], longtasks: [], loaf: [] });
        try {
            new PerformanceObserver(l => { for (const e of l.getEntries()) p.events.push({ name: e.name, dur: e.duration, input: e.processingStart - e.startTime }); })
                .observe({ type: 'event', durationThreshold: 8, buffered: true });
        } catch (e) {}
        try { new PerformanceObserver(l => { for (const e of l.getEntries()) p.longtasks.push(e.duration); }).observe({ entryTypes: ['longtask'] }); } catch (e) {}
        try { new PerformanceObserver(l => { for (const e of l.getEntries()) p.loaf.push({ dur: e.duration, block: e.blockingDuration }); }).observe({ entryTypes: ['long-animation-frame'] }); } catch (e) {}
    });

    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
    await page.bringToFront();
    await page.goto(BASE + '/#/warzone', { waitUntil: 'load' });
    await page.waitForSelector('.ranking-row', { state: 'attached', timeout: 60000 });
    await page.waitForTimeout(1200);

    const reset = () => page.evaluate(() => { const p = window.__ev; p.events.length = 0; p.longtasks.length = 0; p.loaf.length = 0; });
    const collect = () => page.evaluate(() => ({ events: window.__ev.events.slice(), longtasks: window.__ev.longtasks.slice(), loaf: window.__ev.loaf.slice() }));

    async function measure(name, fn) {
        await reset();
        await fn();
        await page.waitForTimeout(400);
        const d = await collect();
        const keys = d.events.filter(e => e.name === 'keydown' || e.name === 'input' || e.name === 'keypress');
        const clicks = d.events.filter(e => e.name === 'click' || e.name === 'pointerdown');
        const p = arr => { const s = arr.map(x => x.dur).sort((a, b) => a - b); return s.length ? { n: s.length, p50: +s[Math.floor(s.length * .5)].toFixed(1), p95: +s[Math.floor(s.length * .95)].toFixed(1), max: +s[s.length - 1].toFixed(1) } : null; };
        const row = {
            name, viewport: `${viewport.width}x${viewport.height}`, cpu: cpuRate,
            keyHandling: p(keys),
            clickHandling: p(clicks),
            inputDelayP95: keys.length ? +keys.map(k => k.input).sort((a, b) => b - a)[Math.floor(keys.length * 0.05)].toFixed(1) : null,
            longTasks: d.longtasks.length,
            longTaskMs: Math.round(d.longtasks.reduce((a, b) => a + b, 0)),
            loafP95: d.loaf.length ? +d.loaf.map(l => l.dur).sort((a, b) => a - b)[Math.floor(d.loaf.length * .95)].toFixed(1) : null
        };
        out.scenarios.push(row);
        console.log(`[${label}] ${name.padEnd(26)} key.p95=${row.keyHandling ? row.keyHandling.p95 : '-'}ms click.p95=${row.clickHandling ? row.clickHandling.p95 : '-'}ms longtask=${row.longTasks}/${row.longTaskMs}ms loaf.p95=${row.loafP95 ?? '-'}`);
        return row;
    }

    const search = page.locator('.ranking-search input');
    await search.click();
    await measure('type-10-chars', async () => { await search.type('27826672', { delay: 60 }); });
    await measure('clear', async () => { await search.fill(''); });

    // 打开筛选，给 3 个区都设 SSS+（最重的过滤条件），再打字
    await page.locator('.filter-btn').click();
    await page.waitForSelector('.filter-pop');
    const sels = page.locator('.filter-pop .char-slot-select');
    const n = await sels.count();
    for (let i = 0; i < Math.min(3, n); i++) await sels.nth(i).selectOption('6');
    const done = page.locator('.sheet-done');
    if (await done.count() && await done.first().isVisible()) await done.first().click();
    else await page.locator('.filter-btn').click();
    await measure('type-with-3-filters', async () => { await search.type('27', { delay: 80 }); });
    await search.fill('');
    await measure('clear-2', async () => { await search.fill(''); });

    await measure('sort-click', async () => { await page.locator('.ranking-header .col-sort').last().click(); });

    await measure('scroll', async () => {
        for (let i = 0; i < 10; i++) { await page.mouse.wheel(0, 280); await page.waitForTimeout(50); }
        await page.mouse.wheel(0, -2800);
    });

    await ctx.close();
}

await run({ width: 1440, height: 900 }, 1, 'desktop-1x');
await run({ width: 390, height: 844 }, 4, 'mobile-4x');

fs.writeFileSync(path.join(DIR, `typing-${TAG}.json`), JSON.stringify(out, null, 2));
console.log(`\n-> docs/perf/typing-${TAG}.json`);
await browser.close();
