// 性能审计：统计每个页面的资源体积（按类型/域名）与关键渲染时间
// 用法：BASE_URL=http://127.0.0.1:4173 node scripts/perf-audit.mjs [tag]
import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4173';
// MOCK=1：拦截 api.huaxu.app，用 docs/perf 里的真实响应回放。
// 源站偶发 20s 不返回，不 mock 的话量不到任何图片，数据没法对比。
const MOCK = process.env.MOCK === '1';
const TAG = process.argv[2] || 'run';
const OUT = 'docs/perf';

const fixtures = {};
async function fixture(file) {
    if (!fixtures[file]) fixtures[file] = await readFile(`docs/perf/${file}`, 'utf8');
    return fixtures[file];
}

async function installMock(page) {
    await page.route('https://api.huaxu.app/**', async route => {
        const path = new URL(route.request().url()).pathname;
        const cors = { 'access-control-allow-origin': '*' };
        const send = async file => route.fulfill({
            status: 200,
            contentType: 'application/json; charset=utf-8',
            headers: cors,
            body: await fixture(file)
        });
        if (/\/players\/\d+\/warzone$/.test(path)) return send('fixture-player-warzone.json');
        if (/\/players\/\d+$/.test(path)) return send('fixture-player.json');
        if (path.includes('/warzone/current/')) return send('fixture-warzone-16.json');
        return route.fulfill({
            status: 200,
            contentType: 'application/json; charset=utf-8',
            headers: cors,
            body: '{"status":"success","data":{}}'
        });
    });
}

const PAGES = [
    { name: 'warzone', hash: '#/warzone' },
    {
        name: 'player',
        hash: '#/player',
        setup: async page => {
            await page.fill('.search-box input', '27826672');
            await page.keyboard.press('Enter');
            await page.waitForSelector('.player-profile', { timeout: 40000 });
        }
    },
    { name: 'ppc', hash: '#/ppc' },
    {
        // 历史战绩：以前逐周 × 段位串行探测（20 周约 27 个请求），现在单请求
        name: 'history',
        hash: '#/player',
        setup: async page => {
            await page.fill('.search-box input', '27826672');
            await page.keyboard.press('Enter');
            await page.waitForSelector('.player-profile', { timeout: 40000 });
            await page.click('button:has-text("历史战绩")');
            await page.waitForSelector('.history-config', { timeout: 10000 });
            await page.click('.history-config .refresh-btn');
            await page.waitForSelector('.history-row', { timeout: 40000 }).catch(() => {});
        }
    }
];

const INIT = `
window.__lcp = 0;
try {
  new PerformanceObserver(list => {
    for (const e of list.getEntries()) window.__lcp = Math.max(window.__lcp, e.startTime);
  }).observe({ type: 'largest-contentful-paint', buffered: true });
} catch (e) {}
`;

function summarize(entries) {
    const byExt = {};
    const byHost = {};
    let total = 0;
    for (const e of entries) {
        const size = e.transferSize || 0;
        total += size;
        const m = e.name.match(/\.([a-z0-9]+)(?:\?|$)/i);
        const ext = m ? m[1].toLowerCase() : 'other';
        byExt[ext] = (byExt[ext] || 0) + size;
        const host = (() => { try { return new URL(e.name).host; } catch { return 'inline'; } })();
        byHost[host] = (byHost[host] || 0) + size;
    }
    return { total, byExt, byHost };
}

const round = n => Math.round(n / 1024);

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = { base: BASE, at: new Date().toISOString(), pages: {} };

for (const spec of PAGES) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' });
    await ctx.addInitScript(INIT);
    const page = await ctx.newPage();
    if (MOCK) await installMock(page);
    await page.goto(`${BASE}/${spec.hash}`, { waitUntil: 'domcontentloaded' });
    if (spec.setup) {
        await spec.setup(page).catch(() => {});
    }
    // 等主要内容出现，最多 40s（源站偶发很慢）
    await page.waitForFunction(
        () => document.querySelectorAll('.ranking-row, .player-profile, .ppc-row, .challenge-card').length > 0,
        null,
        { timeout: 40000 }
    ).catch(() => {});
    await page.waitForTimeout(2500);
    // 让可视区外的图片也触发（滚动一遍）
    await page.evaluate(async () => {
        const step = window.innerHeight * 0.8;
        for (let y = 0; y < document.body.scrollHeight; y += step) {
            window.scrollTo(0, y);
            await new Promise(r => setTimeout(r, 120));
        }
        window.scrollTo(0, 0);
    });
    await page.waitForTimeout(1500);

    const data = await page.evaluate(() => {
        const res = performance.getEntriesByType('resource').map(e => ({
            name: e.name,
            initiatorType: e.initiatorType,
            transferSize: e.transferSize,
            encodedBodySize: e.encodedBodySize,
            duration: e.duration
        }));
        const nav = performance.getEntriesByType('navigation')[0];
        const imgs = [...document.images].map(i => ({
            src: i.currentSrc || i.src,
            w: i.naturalWidth,
            h: i.naturalHeight,
            complete: i.complete
        }));
        return {
            resources: res,
            imgs,
            lcp: window.__lcp || 0,
            dcl: nav ? nav.domContentLoadedEventEnd : 0,
            load: nav ? nav.loadEventEnd : 0,
            nodes: document.querySelectorAll('*').length
        };
    });

    const s = summarize(data.resources);
    const imgBytes = data.resources.filter(r => /\.(png|webp|jpe?g|gif|avif)(\?|$)/i.test(r.name));
    const top = [...data.resources].sort((a, b) => b.transferSize - a.transferSize).slice(0, 12)
        .map(r => ({ url: r.name.replace(/^https?:\/\/[^/]+/, '').slice(0, 90), kb: round(r.transferSize), ms: Math.round(r.duration) }));

    const reqByHost = {};
    for (const r of data.resources) {
        const host = (() => { try { return new URL(r.name).host; } catch { return 'inline'; } })();
        reqByHost[host] = (reqByHost[host] || 0) + 1;
    }

    const entry = {
        requests: data.resources.length,
        reqByHost,
        totalKB: round(s.total),
        byExtKB: Object.fromEntries(Object.entries(s.byExt).map(([k, v]) => [k, round(v)])),
        byHostKB: Object.fromEntries(Object.entries(s.byHost).map(([k, v]) => [k, round(v)])),
        images: { count: imgBytes.length, kb: round(imgBytes.reduce((a, b) => a + b.transferSize, 0)) },
        imgElements: data.imgs.length,
        brokenImgs: data.imgs.filter(i => !i.complete || i.naturalWidth === 0).length,
        lcpMs: Math.round(data.lcp),
        dclMs: Math.round(data.dcl),
        loadMs: Math.round(data.load),
        nodes: data.nodes,
        top
    };
    report.pages[spec.name] = entry;
    console.log(`\n[${spec.name}] 请求 ${entry.requests} · 总计 ${entry.totalKB}KB · 图片 ${entry.images.count} 张/${entry.images.kb}KB · LCP ${entry.lcpMs}ms · DOM ${entry.nodes}`);
    console.log('  按类型', JSON.stringify(entry.byExtKB));
    console.log('  最大请求', entry.top.slice(0, 5).map(t => `${t.kb}KB ${t.url}`).join(' | '));
    await ctx.close();
}

await writeFile(`${OUT}/${TAG}.json`, JSON.stringify(report, null, 2));
console.log(`\n写入 ${OUT}/${TAG}.json`);
await browser.close();
