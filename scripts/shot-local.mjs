import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5199';
const OUT = 'docs/ui-audit/v2';
const HIDE_AD = '.ad-float{display:none!important}';
const HIDE_FEEDBACK = '.corner-feedback{display:none!important}';

async function open(browser, { width, height, dpr, isMobile }) {
    const ctx = await browser.newContext({
        viewport: { width, height },
        deviceScaleFactor: dpr,
        isMobile,
        hasTouch: isMobile,
        locale: 'zh-CN'
    });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/#/warzone`, { waitUntil: 'domcontentloaded' });
    await page.addStyleTag({ content: HIDE_AD + HIDE_FEEDBACK });
    const ready = await page
        .waitForSelector('.ranking-row', { timeout: 45000, state: 'attached' })
        .then(() => true)
        .catch(() => false);
    if (!ready) {
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.addStyleTag({ content: HIDE_AD + HIDE_FEEDBACK });
        await page.waitForSelector('.ranking-row', { timeout: 45000, state: 'attached' }).catch(() => {});
    }
    await page.waitForTimeout(1500);
    await page.addStyleTag({ content: HIDE_AD + HIDE_FEEDBACK });
    // 等头像解码完成（图片原始体积大，dev 环境也没做缓存），最多等 4s
    await page.evaluate(() => Promise.race([
        Promise.all([...document.images].map(img => (img.complete ? null : img.decode().catch(() => null)))),
        new Promise(r => setTimeout(r, 9000))
    ]));
    await page.waitForTimeout(300);
    return { ctx, page };
}

async function metrics(page) {
    return page.evaluate(() => {
        const r = sel => {
            const el = document.querySelector(sel);
            if (!el) return null;
            const b = el.getBoundingClientRect();
            return { top: Math.round(b.top), h: Math.round(b.height), w: Math.round(b.width) };
        };
        return {
            vw: window.innerWidth,
            vh: window.innerHeight,
            scrollH: document.documentElement.scrollHeight,
            docW: document.documentElement.scrollWidth,
            nav: r('.nav'),
            pageHead: r('.page-head'),
            zones: r('.zones-container'),
            panel: r('.rankings'),
            panelHead: r('.panel-head'),
            toolbar: r('.ranking-toolbar'),
            header: r('.ranking-header'),
            firstRow: r('.ranking-row'),
            foot: r('.panel-foot')
        };
    });
}

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });

const d = await open(browser, { width: 1440, height: 900, dpr: 2, isMobile: false });
console.log('home-desktop', JSON.stringify(await metrics(d.page)));
await d.page.screenshot({ path: `${OUT}/home-desktop.png` });
await d.page.hover('.ranking-row .zone-detail').catch(() => {});
await d.page.waitForTimeout(400);
await d.page.screenshot({ path: `${OUT}/home-desktop-hover.png` });
await d.page.click('.filter-btn').catch(() => {});
await d.page.waitForTimeout(350);
await d.page.screenshot({ path: `${OUT}/home-desktop-filter.png` });
await d.page.click('.filter-btn').catch(() => {});
await d.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await d.page.waitForTimeout(400);
await d.page.screenshot({ path: `${OUT}/home-desktop-bottom.png` });
await d.ctx.close();

const m = await open(browser, { width: 390, height: 844, dpr: 3, isMobile: true });
console.log('home-mobile', JSON.stringify(await metrics(m.page)));
await m.page.screenshot({ path: `${OUT}/home-mobile.png` });
await m.page.click('.filter-btn').catch(() => {});
await m.page.waitForTimeout(350);
await m.page.screenshot({ path: `${OUT}/home-mobile-filter.png` });
await m.ctx.close();

await browser.close();
