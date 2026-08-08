// 验证：广告 X 按钮大小 + sessionStorage 关闭逻辑
import { chromium } from 'playwright';

const browser = await chromium.launch();
let failures = 0;
const check = (name, cond, extra = '') => {
    console.log((cond ? 'ok   ' : 'FAIL ') + name + (extra ? ' — ' + extra : ''));
    if (!cond) failures++;
};

const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
const size = await page.evaluate(() => { const r = document.querySelector('.ad-close').getBoundingClientRect(); return { w: r.width, h: r.height }; });
check('X 按钮 ≥32px', size.w >= 32 && size.h >= 32, JSON.stringify(size));
await page.locator('.ad-close').click({ force: true });
await page.waitForTimeout(300);
check('关闭后隐藏', (await page.locator('.ad-float').count()) === 0);
await page.click('.nav-btn:has-text("玩家查询")');
await page.waitForTimeout(500);
check('切页后不再弹出', (await page.locator('.ad-float').count()) === 0);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1200);
check('刷新后不再弹出', (await page.locator('.ad-float').count()) === 0);

const ctx2 = await browser.newContext({ viewport: { width: 375, height: 812 } });
const p2 = await ctx2.newPage();
await p2.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await p2.waitForTimeout(1200);
check('新会话重新出现', (await p2.locator('.ad-float').count()) === 1);

await browser.close();
console.log(failures ? `\n${failures} 项失败` : '\n全部通过');
process.exit(failures ? 1 : 0);
