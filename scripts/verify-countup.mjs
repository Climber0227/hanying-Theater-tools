// 验证：本周分数卡片数字 count-up 就位动画（0 → 最终值滚动）
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
await page.evaluate(() => {
    localStorage.setItem('my_wz_last_sync', JSON.stringify({
        area: { areaInfo: { totalPoint: 30000000, totalChallengeTimes: 3, stageFightInfoList: [] }, groupName: '传奇', groupLevel: '80-120' },
        ppc: { prisonerCage: { totalPoint: 9000000, totalChallengeTimes: 2, bossFightInfoList: [] } },
        roleId: 'test', serverId: 'test'
    }));
});
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
await page.evaluate(() => { const a = document.querySelector('.ad-float'); if (a) a.style.display = 'none'; });
await page.click('.nav-btn:has-text("我的")');
await page.waitForTimeout(600);
// 动画进行中采样
const mid = await page.evaluate(() => [...document.querySelectorAll('.week-stat-num')].map(e => e.innerText));
await page.waitForTimeout(1200);
const end = await page.evaluate(() => [...document.querySelectorAll('.week-stat-num')].map(e => e.innerText));
console.log('动画中(600ms):', JSON.stringify(mid));
console.log('结束(1800ms):', JSON.stringify(end));
console.log('存在滚动过程:', mid.some((v, i) => v !== end[i] && v !== '0') ? 'ok' : 'FAIL');
console.log('最终值正确:', end.includes('30,000,000') && end.includes('9,000,000') ? 'ok' : 'FAIL');
const sw = await page.evaluate(() => document.documentElement.scrollWidth);
console.log('无溢出:', sw <= 375 ? 'ok' : 'FAIL sw=' + sw);
await browser.close();
