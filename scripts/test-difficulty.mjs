// 验证：网络失败时页面不再变成一行红字，而是保留数据 + 横幅 + 可重试
import { chromium } from 'playwright';

const URL = process.env.APP_URL || 'http://127.0.0.1:5199';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const WARZONE_RE = /\/servers\/cn\/warzone\//;

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

let failNext = 0;
const failures = [];
page.on('requestfailed', req => {
    if (WARZONE_RE.test(req.url())) failures.push(req.failure()?.errorText || 'failed');
});

await page.route('**/servers/cn/warzone/**', async route => {
    if (failNext > 0) {
        failNext -= 1;
        await route.abort('failed');
        return;
    }
    await route.continue();
});

const snapshot = () => page.evaluate(() => ({
    rows: document.querySelectorAll('.ranking-row').length,
    alert: document.querySelector('.data-alert-text')?.textContent?.trim() || '',
    alertBtn: document.querySelector('.data-alert-btn')?.textContent?.trim() || '',
    errTitle: document.querySelector('.ranking-empty-title')?.textContent?.trim() || '',
    blankPage: !document.querySelector('.rankings'),
    firstName: document.querySelector('.ranking-row .player-name')?.textContent?.trim() || ''
}));

const clickTier = name => page.locator('.seg-btn', { hasText: name }).first().click();

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.ranking-row', { timeout: 60000 });
console.log('1) 正常加载:', JSON.stringify(await snapshot()));

// A. 有数据时切难度失败：应保留旧数据 + 横幅
failNext = 99;
await clickTier('英雄');
await page.waitForSelector('.data-alert', { timeout: 60000 });
const afterFail = await snapshot();
console.log('2) 切难度全部失败:', JSON.stringify(afterFail));

// B. 网络恢复后点「重试」：横幅消失、数据换成本周
failNext = 0;
await page.locator('.data-alert-btn').click();
await page.waitForSelector('.data-alert', { state: 'detached', timeout: 60000 });
const afterRetry = await snapshot();
console.log('3) 点重试后恢复:', JSON.stringify(afterRetry));

// C. 冷启动就失败：应是「数据加载失败 + 重试」而不是一行红字
failNext = 99;
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('.ranking-empty-title', { timeout: 60000 });
const coldFail = await snapshot();
console.log('4) 冷启动失败:', JSON.stringify(coldFail));

failNext = 0;
await page.locator('.ranking-empty .reset-filter-btn').click();
await page.waitForSelector('.ranking-row', { timeout: 60000 });
const coldRecover = await snapshot();
console.log('5) 冷启动重试后:', JSON.stringify(coldRecover));

await page.screenshot({ path: 'docs/ui-audit/v2/error-state.png' });
await browser.close();

const checks = [
    ['切难度失败不空白', afterFail.blankPage === false && afterFail.alert.length > 0],
    ['切难度失败保留旧数据', afterFail.rows > 0],
    ['失败提示是中文网络文案', afterFail.alert.includes('网络')],
    ['重试可恢复', afterRetry.alert === '' && afterRetry.rows > 0],
    ['冷启动失败有重试入口', coldFail.errTitle === '数据加载失败'],
    ['冷启动重试后出数据', coldRecover.rows > 0 && coldRecover.blankPage === false]
];
console.log('\n断言:');
for (const [name, ok] of checks) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
console.log(`拦截失败次数: ${failures.length}`);