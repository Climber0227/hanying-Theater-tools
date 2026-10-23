import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5199';
const OUT = 'docs/ui-audit/v2';
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
    await page.addStyleTag({ content: HIDE_FEEDBACK });
    const ready = await page
        .waitForSelector('.ranking-row', { timeout: 45000, state: 'attached' })
        .then(() => true)
        .catch(() => false);
    if (!ready) {
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.addStyleTag({ content: HIDE_FEEDBACK });
        await page.waitForSelector('.ranking-row', { timeout: 45000, state: 'attached' }).catch(() => {});
    }
    await page.waitForTimeout(1200);
    await page.addStyleTag({ content: HIDE_FEEDBACK });
    await page.evaluate(() => Promise.race([
        Promise.all([...document.images].map(img => (img.complete ? null : img.decode().catch(() => null)))),
        new Promise(r => setTimeout(r, 9000))
    ]));
    await page.waitForTimeout(300);
    return { ctx, page };
}

async function metrics(page, label) {
    const m = await page.evaluate(() => {
        const r = sel => {
            const el = document.querySelector(sel);
            if (!el) return null;
            const b = el.getBoundingClientRect();
            return { left: Math.round(b.left), top: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) };
        };
        return {
            vw: window.innerWidth,
            vh: window.innerHeight,
            docW: document.documentElement.scrollWidth,
            card: r('.update-card'),
            tab: r('.update-tab'),
            fab: r('.update-fab'),
            sheet: r('.update-sheet'),
            panel: r('.rankings'),
            firstRow: r('.ranking-row'),
            overlapPanel: (() => {
                const c = document.querySelector('.update-card');
                const p = document.querySelector('.rankings');
                if (!c || !p) return null;
                const a = c.getBoundingClientRect();
                const b = p.getBoundingClientRect();
                return Math.max(0, Math.round(a.right - b.left));
            })(),
            items: [...document.querySelectorAll('.uc-item')].length
        };
    });
    console.log(label, JSON.stringify(m));
    return m;
}

const browser = await chromium.launch({ channel: 'chrome' });
await mkdir(OUT, { recursive: true });

// 桌面：卡片常驻 → 收起 → 再展开 → 点条目跳转
{
    const { ctx, page } = await open(browser, { width: 1440, height: 900, dpr: 2, isMobile: false });
    await metrics(page, 'desktop-card');
    await page.screenshot({ path: `${OUT}/rail-desktop-card.png` });
    await page.click('.uc-close');
    await page.waitForTimeout(400);
    await metrics(page, 'desktop-tucked');
    await page.screenshot({ path: `${OUT}/rail-desktop-tucked.png` });
    await page.click('.update-tab');
    await page.waitForTimeout(400);
    await metrics(page, 'desktop-untucked');
    await page.click('.uc-item:first-child .uc-link');
    await page.waitForTimeout(1200);
    console.log('after-click-hash', await page.evaluate(() => location.hash));
    console.log('changelog-visible', await page.locator('.tl-h2').count());
    await page.screenshot({ path: `${OUT}/rail-click-changelog.png` });
    await ctx.close();
}

// 宽屏 1920：看卡片与内容的相对位置
{
    const { ctx, page } = await open(browser, { width: 1920, height: 1080, dpr: 1, isMobile: false });
    await metrics(page, 'wide-1920');
    await page.screenshot({ path: `${OUT}/rail-wide-1920.png` });
    await ctx.close();
}

// 手机：悬浮按钮 → 弹层 → 点条目跳转
{
    const { ctx, page } = await open(browser, { width: 390, height: 844, dpr: 3, isMobile: true });
    await metrics(page, 'mobile-fab');
    await page.screenshot({ path: `${OUT}/rail-mobile-fab.png` });
    await page.click('.update-fab');
    await page.waitForTimeout(500);
    await metrics(page, 'mobile-sheet');
    await page.screenshot({ path: `${OUT}/rail-mobile-sheet.png` });
    await page.click('.update-sheet .uc-item:first-child .uc-link');
    await page.waitForTimeout(1200);
    console.log('mobile-after-click-hash', await page.evaluate(() => location.hash));
    console.log('mobile-changelog-visible', await page.locator('.tl-h2').count());
    await ctx.close();
}

await browser.close();
console.log('done');
