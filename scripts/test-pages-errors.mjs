// 验证：玩家查询、幻痛囚笼的网络失败文案与重试
import { chromium } from 'playwright';

const URL = process.env.APP_URL || 'http://127.0.0.1:5199';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

let failPlayer = false;
let failPpc = false;
await page.route('**/servers/cn/players/**', route => (failPlayer ? route.abort('failed') : route.continue()));
await page.route('**/servers/cn/ppc/**', route => (failPpc ? route.abort('failed') : route.continue()));

const alertText = () => page.evaluate(() => document.querySelector('.data-alert-text')?.textContent?.trim() || '');

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.ranking-row', { timeout: 60000 });

// A. 玩家查询：断网时说「网络连接失败」，不能说「未找到该玩家」
await page.locator('.nav-btn', { hasText: '玩家查询' }).click();
failPlayer = true;
await page.locator('.search-box input').fill('27826672');
await page.locator('.search-box button').click();
await page.waitForSelector('.data-alert', { timeout: 60000 });
const playerFail = { text: await alertText(), retry: (await page.locator('.data-alert-btn').count()) > 0 };
console.log('玩家查询断网:', JSON.stringify(playerFail));

failPlayer = false;
await page.locator('.data-alert-btn').click();
await page.waitForSelector('.player-profile', { timeout: 90000 });
console.log('玩家查询重试后: 资料卡已渲染, 横幅=', await page.locator('.data-alert').count());

// B. 不存在的玩家仍然报「未找到该玩家」
await page.locator('.search-box input').fill('999999999');
await page.locator('.search-box button').click();
await page.waitForSelector('.data-alert', { timeout: 60000 });
const notFound = await alertText();
console.log('不存在的玩家:', JSON.stringify(notFound));

// C. 幻痛囚笼断网：出现横幅 + 重试，而不是静默空白
failPpc = true;
await page.locator('.nav-btn', { hasText: '幻痛囚笼' }).click();
await page.waitForSelector('.data-alert', { timeout: 60000 });
const ppcFail = await alertText();
console.log('幻痛断网:', JSON.stringify(ppcFail));

failPpc = false;
await page.locator('.data-alert-btn').click();
await page.waitForSelector('.ppc-boss-card', { timeout: 90000 });
console.log('幻痛重试后: boss 卡数量 =', await page.locator('.ppc-boss-card').count());

await browser.close();

const checks = [
    ['玩家断网提示为网络错误', playerFail.text.includes('网络') && !playerFail.text.includes('未找到')],
    ['玩家断网有重试按钮', playerFail.retry === true],
    ['真·不存在的玩家仍提示未找到', notFound.includes('未找到')],
    ['幻痛断网有横幅', ppcFail.includes('网络')]
];
console.log('\n断言:');
for (const [name, ok] of checks) console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);