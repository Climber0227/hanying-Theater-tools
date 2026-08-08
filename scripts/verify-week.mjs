// 验证：周区间日期渲染
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
await page.evaluate(() => {
    const now = Date.now();
    localStorage.setItem('my_wz_scores', JSON.stringify([{ week: 5, groupName: '传奇', groupLevel: '80-120', zones: [{ name: '火焰轮回', score: 1 }], total: 1, timestamp: now }]));
});
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
await page.evaluate(() => { const a = document.querySelector('.ad-float'); if (a) a.style.display = 'none'; });
await page.click('.nav-btn:has-text("我的")');
await page.waitForTimeout(3500);
const r = await page.evaluate(() => {
    const cell = document.querySelector('.score-week-cell');
    return cell ? cell.innerText : 'NOT FOUND';
});
console.log('周单元格:', JSON.stringify(r));
console.log('含第N周:', /第5周/.test(r) ? 'ok' : 'FAIL');
console.log('含日期区间:', /\d+\.\d+~\d+\.\d+/.test(r) ? 'ok' : 'FAIL');
const sw = await page.evaluate(() => document.documentElement.scrollWidth);
console.log('页面溢出:', sw > 375 ? 'FAIL sw=' + sw : 'ok');
await browser.close();
