// 线上部署验证：真实浏览器打开站点，确认榜单走 /api/huaxu 且能拿到数据
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'https://jiatenghui.icu';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const hits = [];
page.on('response', async (r) => {
    const u = r.url();
    if (!u.includes('/api/huaxu')) return;
    let h = {};
    try { h = await r.allHeaders(); } catch {}
    hits.push({
        status: r.status(),
        cache: h['x-vercel-cache'] || '',
        state: h['x-data-state'] || '',
        age: h['age'] || '',
        cc: h['cache-control'] || '',
        len: h['content-length'] || ''
    });
});

const t0 = Date.now();
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
let ok = false;
try {
    await page.waitForSelector('.ranking-row', { timeout: 90000 });
    ok = true;
} catch {}
const firstRowMs = Date.now() - t0;
const rows = await page.locator('.ranking-row').count();
const firstText = rows ? (await page.locator('.ranking-row').first().innerText()).replace(/\s+/g, ' ').slice(0, 80) : '';

// 再切一次难度，验证代理路径切换
let second = null;
if (ok) {
    const t1 = Date.now();
    await page.selectOption('.week-select', { index: 0 }).catch(() => {});
    await page.locator('.seg-btn', { hasText: '英雄' }).first().click().catch(() => {});
    await page.waitForTimeout(1500);
    second = { ms: Date.now() - t1, rows: await page.locator('.ranking-row').count() };
}

const imgs = await page.evaluate(() => {
    const all = [...document.querySelectorAll('img')];
    return {
        total: all.length,
        webp: all.filter((i) => i.currentSrc.includes('.webp')).length,
        png: all.filter((i) => i.currentSrc.includes('.png')).length,
        broken: all.filter((i) => i.complete && i.naturalWidth === 0).length
    };
});
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));

console.log(JSON.stringify({ firstRowMs, rows, firstText, ok, second, imgs, hits, errs }, null, 2));
await browser.close();
