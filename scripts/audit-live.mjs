import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

// 线上全站体检：5 个页面 × 桌面/手机，截图 + 页面级指标 + 报错采集
const BASE = process.env.BASE_URL || 'https://jiatenghui.icu';
const OUT = 'docs/ui-audit/audit2';
const HIDE = '.ad-float{display:none!important}.corner-feedback{display:none!important}';

await mkdir(OUT, { recursive: true });

const VIEWPORTS = [
    { tag: 'desktop', width: 1440, height: 900, dpr: 1.5, isMobile: false },
    { tag: 'mobile', width: 390, height: 844, dpr: 3, isMobile: true }
];
const PAGES = ['warzone', 'player', 'ppc', 'mine', 'changelog'];

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = {};

for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: vp.dpr,
        isMobile: vp.isMobile,
        hasTouch: vp.isMobile,
        locale: 'zh-CN'
    });
    for (const name of PAGES) {
        const page = await ctx.newPage();
        const errors = [];
        const failed = [];
        page.on('pageerror', e => errors.push(String(e).slice(0, 160)));
        page.on('requestfailed', r => failed.push(`${r.method()} ${r.url().slice(0, 110)} ${r.failure()?.errorText || ''}`));
        const url = name === 'warzone' ? `${BASE}/` : `${BASE}/#/${name}`;
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(e => errors.push('goto:' + e.message));
        if (name === 'warzone') {
            await page.waitForSelector('.ranking-row', { timeout: 45000, state: 'attached' }).catch(() => {});
        }
        await page.waitForTimeout(2600);
        await page.addStyleTag({ content: HIDE }).catch(() => {});
        await page.waitForTimeout(200);
        await page.screenshot({ path: `${OUT}/${vp.tag}-${name}-top.png`, fullPage: false });

        const m = await page.evaluate(() => {
            const all = [...document.querySelectorAll('body *')];
            const rect = el => el.getBoundingClientRect();
            // 横向溢出：元素右边超出视口
            const overflowRight = all
                .filter(el => {
                    const b = rect(el);
                    return b.width > 0 && b.height > 0 && b.right > window.innerWidth + 2 && getComputedStyle(el).position !== 'fixed';
                })
                .slice(0, 6)
                .map(el => ({
                    cls: (el.className && el.className.toString().slice(0, 60)) || el.tagName,
                    right: Math.round(rect(el).right)
                }));
            // 可点元素过小（<28px）
            const tiny = [...document.querySelectorAll('button, a[href], select')]
                .filter(el => {
                    const b = rect(el);
                    const vis = b.width > 0 && b.height > 0 && b.bottom > 0 && b.top < window.innerHeight;
                    return vis && (b.height < 28 || b.width < 28);
                })
                .slice(0, 10)
                .map(el => ({
                    cls: (el.className && el.className.toString().slice(0, 50)) || el.tagName,
                    w: Math.round(rect(el).width),
                    h: Math.round(rect(el).height),
                    text: (el.textContent || '').trim().slice(0, 24)
                }));
            const fixed = all
                .filter(el => getComputedStyle(el).position === 'fixed' && rect(el).width > 0)
                .map(el => ({
                    cls: (el.className && el.className.toString().slice(0, 46)) || el.tagName,
                    box: [Math.round(rect(el).left), Math.round(rect(el).top), Math.round(rect(el).width), Math.round(rect(el).height)]
                }));
            return {
                scrollH: document.documentElement.scrollHeight,
                scrollW: document.documentElement.scrollWidth,
                vw: window.innerWidth,
                vh: window.innerHeight,
                overflowRight,
                tiny,
                fixed,
                h1: [...document.querySelectorAll('h1, .page-title, .tl-h2')].map(e => (e.textContent || '').trim().slice(0, 20))
            };
        });
        report[`${vp.tag}-${name}`] = { ...m, errors: errors.slice(0, 5), failed: failed.slice(0, 6) };
        console.log(vp.tag, name, JSON.stringify({ h: m.scrollH, w: m.scrollW, vw: m.vw, err: errors.length, failed: failed.length, tiny: m.tiny.length, over: m.overflowRight.length }));
        await page.close();
    }
    await ctx.close();
}

await browser.close();
const { writeFile } = await import('node:fs/promises');
await writeFile(`${OUT}/report.json`, JSON.stringify(report, null, 1), 'utf8');
console.log('report written');
