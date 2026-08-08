// 验证：历史记录每周区名行内自描述（表头通用区1/区2/区3）
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
await page.evaluate(() => {
    localStorage.setItem('my_wz_scores', JSON.stringify([
        { week: 582, groupName: '传奇', groupLevel: '80-120', zones: [
            { name: '火焰轮回', score: 10000000, team: [], mech: '困兽犹斗', monster: '单怪', weather: '薪炎崇光', teamRank: { rank: 5, total: 100 } },
            { name: '空域浮台', score: 11000000, team: [], mech: '祸不单行', monster: '双怪', weather: '原初空栈', teamRank: { rank: 8, total: 100 } },
            { name: '熵钟异数', score: 12000000, team: [], mech: '困兽犹斗', monster: '单怪', weather: '悼亡鸦吟', teamRank: { rank: 3, total: 100 } }
        ], total: 33000000, totalRank: 12, totalDiff: 0, timestamp: Date.now() },
        { week: 580, groupName: '传奇', groupLevel: '80-120', zones: [
            { name: '赤羽深林', score: 8000000, team: [], mech: '围剿', monster: '群怪', weather: '雾锁' },
            { name: '玄冥渊海', score: 9000000, team: [], mech: '困兽犹斗', monster: '单怪', weather: '潮汐' },
            { name: '苍雷绝域', score: 9500000, team: [], mech: '祸不单行', monster: '双怪', weather: '雷暴' }
        ], total: 26500000, totalRank: 0, totalDiff: 0, timestamp: Date.now() - 14 * 86400000 }
    ]));
});
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
await page.evaluate(() => { const a = document.querySelector('.ad-float'); if (a) a.style.display = 'none'; });
await page.click('.nav-btn:has-text("我的")');
await page.waitForTimeout(3500);
const result = await page.evaluate(() => {
    const headers = [...document.querySelectorAll('.score-table thead th')].map(th => th.innerText);
    const zones = [...document.querySelectorAll('.score-cell-zone')].map(z => z.innerText);
    return { headers, zones, rows: document.querySelectorAll('.score-table tbody tr').length };
});
console.log('表头:', JSON.stringify(result.headers));
console.log('行内区名:', JSON.stringify(result.zones));
console.log('表头通用列:', result.headers.slice(1, 4).every(h => /^区\d$/.test(h)) ? 'ok' : 'FAIL', JSON.stringify(result.headers.slice(1, 4)));
console.log('两行区名不同（每周自描述）:', result.rows === 2 && result.zones.length === 6 ? 'ok' : 'FAIL');
const sw = await page.evaluate(() => document.documentElement.scrollWidth);
console.log('无溢出:', sw <= 375 ? 'ok' : 'FAIL sw=' + sw);
await browser.close();
