// 弹窗与其余页面 UI 截图
import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE = process.argv[2] || 'https://jiatenghui.icu';
const OUT = 'docs/ui-audit/current';
await fs.mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('.ranking-row', { timeout: 45000 }).catch(() => {});
await page.waitForTimeout(2500);
await page.evaluate(() => { const a = document.querySelector('.ad-float'); if (a) a.style.display = 'none'; });

async function shot(name) {
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/${name}.png` });
    console.log('shot', name);
}

// 分数分布
for (const [label, name] of [['分数分布', 'modal-bracket'], ['阵容参考', 'modal-team'], ['阵容排行', 'modal-ranking']]) {
    const btn = page.locator('.bracket-btn', { hasText: label }).first();
    if (await btn.count()) {
        await btn.click();
        await shot(name);
        await page.keyboard.press('Escape').catch(() => {});
        // 点关闭按钮
        await page.evaluate(() => { const b = document.querySelector('.modal-close'); if (b) b.click(); });
        await page.waitForTimeout(500);
    }
}

// 行内 分析 / 趋势
const row = page.locator('.ranking-row').first();
await row.scrollIntoViewIfNeeded();
const analysis = row.locator('button', { hasText: '分析' }).first();
if (await analysis.count()) {
    await analysis.click();
    await shot('modal-analysis');
    await page.evaluate(() => { const b = document.querySelector('.modal-close'); if (b) b.click(); });
    await page.waitForTimeout(500);
}
const trend = row.locator('button', { hasText: '趋势' }).first();
if (await trend.count()) {
    await trend.click();
    await shot('modal-trend');
    await page.evaluate(() => { const b = document.querySelector('.modal-close'); if (b) b.click(); });
    await page.waitForTimeout(500);
}

await page.click('.nav-btn:has-text("更新日志")');
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/desktop-changelog-view.png` });
await page.screenshot({ path: `${OUT}/desktop-changelog-full.png`, fullPage: true });
console.log('shot changelog');

await browser.close();
