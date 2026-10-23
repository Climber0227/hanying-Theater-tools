// 线上验证加载页：无 JS 时加载页是否可见、有 JS 时是否会自己撤掉。
import { chromium } from 'playwright';
import fs from 'node:fs';

const URL = process.env.URL || 'https://jiatenghui.icu/';
const OUT = 'docs/ui-audit/v2';
const browser = await chromium.launch({ channel: 'chrome' });
const out = {};

// 1) 关掉 JS：加载页必须仍然可见（说明它不依赖任何 JS/CSS 包）
{
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: 'commit' });
    await page.waitForSelector('#boot', { state: 'visible', timeout: 20000 });
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/live-boot-nojs.png` });
    out.noJs = await page.evaluate(() => {
        const b = document.getElementById('boot');
        const r = b.getBoundingClientRect();
        return {
            visible: getComputedStyle(b).opacity !== '0',
            covers: Math.round((r.width * r.height) / (innerWidth * innerHeight) * 100),
            tip: document.getElementById('boot-tip').textContent
        };
    });
    await ctx.close();
}

// 2) 正常打开：加载页出现后自动淡出移除，内容接管
for (const [tag, viewport, dpr] of [['desktop', { width: 1440, height: 900 }, 2], ['mobile', { width: 390, height: 844 }, 3]]) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: dpr });
    const page = await ctx.newPage();
    const t0 = Date.now();
    await page.goto(URL, { waitUntil: 'commit' });

    // 抓住加载页还在的那一刻
    const bootAt = await page.evaluate(() => (document.getElementById('boot') ? performance.now() : -1)).catch(() => -1);
    await page.screenshot({ path: `${OUT}/live-boot-${tag}.png` }).catch(() => {});

    const goneAt = await page
        .waitForFunction(() => !document.getElementById('boot'), null, { timeout: 30000 })
        .then(() => Date.now() - t0)
        .catch(() => -1);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${OUT}/live-after-boot-${tag}.png` });
    out[tag] = {
        bootPresentAtStart: bootAt >= 0,
        bootRemovedAfterMs: goneAt,
        rows: await page.evaluate(() => document.querySelectorAll('.ranking-row, .skeleton-row').length),
        skeleton: await page.evaluate(() => document.querySelectorAll('.skeleton-row').length),
        zoneCards: await page.evaluate(() => document.querySelectorAll('.zone-card').length),
        sceneCardsSkeleton: await page.evaluate(() => document.querySelectorAll('.zone-card-skeleton').length)
    };
    await ctx.close();
}

await browser.close();
fs.writeFileSync('docs/perf/boot-live.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
