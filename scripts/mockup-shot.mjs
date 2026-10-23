// 设计稿截图
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs/promises';

const file = path.resolve('docs/ui-audit/mockup/home-v2.html');
const out = 'docs/ui-audit/mockup';
await fs.mkdir(out, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', headless: true });

for (const theme of ['light', 'dark']) {
    const url = `file:///${file.replace(/\\/g, '/')}?theme=${theme}`;
    // 桌面
    let ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    let page = await ctx.newPage();
    await page.goto(url);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${out}/home-${theme}-desktop.png` });
    // 移动
    await ctx.close();
    ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    page = await ctx.newPage();
    await page.goto(url);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${out}/home-${theme}-mobile.png` });
    await page.screenshot({ path: `${out}/home-${theme}-mobile-full.png`, fullPage: true });
    await ctx.close();
    console.log('done', theme);
}

await browser.close();
