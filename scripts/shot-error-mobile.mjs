// 移动端失败横幅截图
import { chromium } from 'playwright';

const URL = process.env.APP_URL || 'http://127.0.0.1:5199';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
});

let failNext = 0;
await page.route('**/servers/cn/warzone/**', route => {
    if (failNext > 0) { failNext -= 1; return route.abort('failed'); }
    return route.continue();
});

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.ranking-row', { timeout: 60000 });
await page.addStyleTag({ content: '.ad-float,.corner-feedback{display:none!important}' });

failNext = 99;
await page.locator('.seg-btn', { hasText: '英雄' }).first().click();
await page.waitForSelector('.data-alert', { timeout: 60000 });
await page.waitForTimeout(500);
const box = await page.locator('.data-alert').boundingBox();
console.log('横幅几何:', JSON.stringify(box), '文档宽:', await page.evaluate(() => document.documentElement.scrollWidth));
await page.screenshot({ path: 'docs/ui-audit/v2/error-banner-mobile.png' });
await browser.close();