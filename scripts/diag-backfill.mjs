// 调试：backfill effect 执行与请求
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
const reqs = [];
page.on('request', r => { if (r.url().includes('warzone')) reqs.push(r.url()); });
page.on('console', m => { if (m.text().includes('BACKFILL')) console.log('LOG:', m.text()); });
page.on('pageerror', e => console.log('PAGE_ERR:', String(e).slice(0, 300)));
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
await page.evaluate(() => {
    localStorage.setItem('my_wz_scores', JSON.stringify([
        { week: 582, groupName: '传奇', groupLevel: '80-120', zones: [{ name: '火焰轮回', score: 10000000, team: [] }], total: 10000000, totalRank: 0, totalDiff: 0, timestamp: Date.now() }
    ]));
});
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
await page.evaluate(() => { const a = document.querySelector('.ad-float'); if (a) a.style.display = 'none'; });
await page.click('.nav-btn:has-text("我的")');
await page.waitForTimeout(8000);
console.log('warzone 请求:', JSON.stringify(reqs));
const cell = await page.evaluate(() => document.querySelector('.score-cell-mech')?.innerText || 'NONE');
console.log('标签:', cell);
await browser.close();
