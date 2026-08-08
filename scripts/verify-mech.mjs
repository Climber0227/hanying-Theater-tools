// 验证：历史记录机制/天气标签渲染
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
await page.evaluate(() => {
    localStorage.setItem('my_wz_scores', JSON.stringify([{
        week: 1,
        groupName: '传奇', groupLevel: '80-120',
        zones: [
            { name: '火焰轮回', score: 10000000, team: [], mech: '困兽犹斗', monster: '单怪', weather: '沙暴', teamRank: { rank: 5, total: 100 } },
            { name: '空域浮台', score: 11000000, team: [], mech: '祸不单行', monster: '双怪', weather: '雷暴', teamRank: { rank: 8, total: 100 } },
            { name: '熵钟异数', score: 12000000, team: [], mech: '围剿', monster: '群怪', weather: '', teamRank: { rank: 3, total: 100 } }
        ],
        total: 33000000, totalRank: 12, totalDiff: 0, timestamp: Date.now()
    }, {
        week: 2,
        groupName: '传奇', groupLevel: '80-120',
        zones: [
            { name: '火焰轮回', score: 9000000, team: [] },
            { name: '空域浮台', score: 10000000, team: [] },
            { name: '熵钟异数', score: 11000000, team: [] }
        ],
        total: 30000000, totalRank: 20, totalDiff: 1000000, timestamp: Date.now() - 86400000
    }]));
});
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
await page.evaluate(() => { const a = document.querySelector('.ad-float'); if (a) a.style.display = 'none'; });
await page.click('.nav-btn:has-text("我的")');
await page.waitForTimeout(3500);

const tags = await page.evaluate(() => [...document.querySelectorAll('.score-cell-mech')].map(t => t.innerText));
console.log('机制标签:', JSON.stringify(tags, null, 1));
const sw = await page.evaluate(() => document.documentElement.scrollWidth);
console.log('页面溢出:', sw > 375 ? 'FAIL sw=' + sw : 'ok');
const tableScroll = await page.evaluate(() => { const c = document.querySelector('.table-scroll'); return { scrollW: c.scrollWidth, clientW: c.clientWidth, hasScroll: c.scrollWidth > c.clientWidth }; });
console.log('表格横滚容器:', JSON.stringify(tableScroll));
await browser.close();
