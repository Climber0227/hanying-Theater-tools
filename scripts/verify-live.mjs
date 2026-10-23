// 线上验证：我的页历史记录 周区间日期 + 机制标签
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
await page.goto('https://jiatenghui.icu/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(3000);
// 注入测试数据验证线上渲染
await page.evaluate(() => {
    localStorage.setItem('my_wz_scores', JSON.stringify([{
        week: 5, groupName: '传奇', groupLevel: '80-120',
        zones: [{ name: '火焰轮回', score: 10000000, team: [], mech: '困兽犹斗', monster: '单怪', weather: '沙暴', teamRank: { rank: 5, total: 100 } }],
        total: 10000000, totalRank: 12, totalDiff: 0, timestamp: Date.now()
    }]));
});
await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(3000);
await page.click('.nav-btn:has-text("我的")');
await page.waitForTimeout(4000);
const r = await page.evaluate(() => {
    const week = document.querySelector('.score-week-cell');
    const mech = document.querySelector('.score-cell-mech');
    return {
        week: week ? week.innerText : 'NOT FOUND',
        mech: mech ? mech.innerText : 'NOT FOUND',
        sw: document.documentElement.scrollWidth
    };
});
console.log(JSON.stringify(r, null, 1));
console.log('周+日期:', /第5周/.test(r.week) && /\d+\.\d+~\d+\.\d+/.test(r.week) ? 'ok' : 'FAIL');
console.log('机制标签:', r.mech.includes('困兽犹斗') && r.mech.includes('单怪') && r.mech.includes('沙暴') ? 'ok' : 'FAIL');
console.log('无溢出:', r.sw <= 375 ? 'ok' : 'FAIL sw=' + r.sw);
await browser.close();
