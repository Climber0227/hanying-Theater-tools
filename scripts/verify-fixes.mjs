// 验证：手机端排序行 + mine 页布局压缩
import { chromium } from 'playwright';

const browser = await chromium.launch();
let failures = 0;
const check = (name, cond, extra = '') => {
    console.log((cond ? 'ok   ' : 'FAIL ') + name + (extra ? ' — ' + extra : ''));
    if (!cond) failures++;
};

// --- 1. 战区数据：排序行 + 点击排序生效 ---
const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
await page.evaluate(() => { const a = document.querySelector('.ad-float'); if (a) a.style.display = 'none'; });
await page.waitForSelector('.mobile-sort-row', { timeout: 10000 });
const sortBtns = await page.evaluate(() => [...document.querySelectorAll('.mobile-sort-btn')].map(b => b.innerText.trim()));
check('排序行渲染（3区+总分）', sortBtns.length >= 4, JSON.stringify(sortBtns));

// 点击总分排序 → active 变化
const beforeActive = await page.evaluate(() => document.querySelector('.mobile-sort-btn.active')?.innerText || '');
await page.locator('.mobile-sort-btn', { hasText: '总分' }).click();
await page.waitForTimeout(400);
const afterActive = await page.evaluate(() => document.querySelector('.mobile-sort-btn.active')?.innerText || '');
check('点击总分→排序激活', afterActive.includes('总分') && afterActive.includes('▼'), `before=${beforeActive} after=${afterActive}`);
// 再点切换升序
await page.locator('.mobile-sort-btn', { hasText: '总分' }).click();
await page.waitForTimeout(400);
const ascActive = await page.evaluate(() => document.querySelector('.mobile-sort-btn.active')?.innerText || '');
check('再点→切换升序', ascActive.includes('▲'), ascActive);
// 重置筛选按钮存在于折叠面板内
await page.locator('.mobile-filter-toggle').click();
await page.waitForTimeout(300);
check('折叠面板内重置按钮', (await page.locator('.reset-filter-btn').count()) > 0);

// --- 2. mine 页：注入数据检查布局 ---
await page.evaluate(() => {
    const monday = new Date();
    monday.setHours(0, 0, 0, 0);
    const samples = [];
    for (let h = 0; h < 8; h++) {
        samples.push({ t: monday.getTime() + h * 3600000, total: 20000000 + h * 3000000, zones: [7000000 + h * 1000000, 6000000 + h * 1000000, 7000000 + h * 1000000] });
    }
    localStorage.setItem('my_wz_today_samples', JSON.stringify(samples));
});
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1200);
await page.evaluate(() => { const a = document.querySelector('.ad-float'); if (a) a.style.display = 'none'; });
await page.click('.nav-btn:has-text("我的")');
await page.waitForTimeout(3500);
const mine = await page.evaluate(() => {
    const iw = window.innerWidth;
    const guide = document.querySelector('.setup-guide');
    const steps = [...document.querySelectorAll('.guide-step')].map(s => { const r = s.getBoundingClientRect(); return { w: Math.round(r.width) }; });
    const acct = document.querySelector('.account-grid');
    const out = [];
    document.querySelectorAll('*').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && (r.right > iw + 1 || r.left < -1)) out.push(String(el.className || '').slice(0, 40));
    });
    return {
        sw: document.documentElement.scrollWidth, iw,
        guideW: guide ? Math.round(guide.getBoundingClientRect().width) : 0,
        stepW: steps[0] ? steps[0].w : 0,
        acctCols: acct ? getComputedStyle(acct).gridTemplateColumns.split(' ').length : 0,
        overflowers: out.slice(0, 10)
    };
});
check('mine 无溢出', !(mine.sw > mine.iw + 1), JSON.stringify(mine.overflowers));
check('引导单列且收窄', mine.stepW > 0 && mine.stepW < 340, `stepW=${mine.stepW}`);
check('账号板块单列', mine.acctCols === 1, `cols=${mine.acctCols}`);

await browser.close();
console.log(failures ? `\n${failures} 项失败` : '\n全部通过');
process.exit(failures ? 1 : 0);
