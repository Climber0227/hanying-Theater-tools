// 截取「网络失败横幅」与正常状态（用于交付说明）
import { chromium } from 'playwright';

const URL = process.env.APP_URL || 'http://127.0.0.1:5199';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2
});

let failNext = 0;
await page.route('**/servers/cn/warzone/**', route => {
    if (failNext > 0) { failNext -= 1; return route.abort('failed'); }
    return route.continue();
});

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.ranking-row', { timeout: 60000 });
await page.addStyleTag({ content: '.ad-float,.corner-feedback{display:none!important}' });
await page.waitForTimeout(2500);
await page.screenshot({ path: 'docs/ui-audit/v2/home-desktop-2.png' });

failNext = 99;
await page.locator('.seg-btn', { hasText: '英雄' }).first().click();
await page.waitForSelector('.data-alert', { timeout: 60000 });
await page.waitForTimeout(600);
await page.screenshot({ path: 'docs/ui-audit/v2/error-banner.png' });
console.log('banner:', await page.evaluate(() => document.querySelector('.data-alert')?.innerText));
await browser.close();