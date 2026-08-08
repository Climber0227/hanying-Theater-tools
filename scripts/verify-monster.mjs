// 验证：怪数量标签（机制名映射：困兽犹斗=单怪/祸不单行=双怪/其他=群怪）
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
// 注入无 monster 字段的旧记录（当前周，触发按周补齐）
await page.evaluate(() => {
    localStorage.setItem('my_wz_scores', JSON.stringify([
        { week: 582, groupName: '传奇', groupLevel: '80-120', zones: [
            { name: '火焰轮回', score: 10000000, team: [] },
            { name: '空域浮台', score: 11000000, team: [] },
            { name: '熵钟异数', score: 12000000, team: [] }
        ], total: 33000000, totalRank: 0, totalDiff: 0, timestamp: Date.now() }
    ]));
});
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
await page.evaluate(() => { const a = document.querySelector('.ad-float'); if (a) a.style.display = 'none'; });
await page.click('.nav-btn:has-text("我的")');
await page.waitForTimeout(10000); // 等待按周补齐请求
const result = await page.evaluate(() => ({
    labels: [...document.querySelectorAll('.score-cell-mech')].map(t => ({ text: t.innerText, title: t.title })),
    stored: JSON.parse(localStorage.getItem('my_wz_scores'))[0].zones.map(z => ({ name: z.name, mech: z.mech, monster: z.monster }))
}));
console.log('渲染标签:', JSON.stringify(result.labels));
console.log('存储:', JSON.stringify(result.stored, null, 1));
const texts = result.labels.map(l => l.text);
console.log('三个怪数标签:', texts.length === 3 ? 'ok' : 'FAIL', JSON.stringify(texts));
console.log('单怪(困兽犹斗):', texts.includes('单怪') ? 'ok' : 'FAIL');
console.log('双怪(祸不单行):', texts.includes('双怪') ? 'ok' : 'FAIL');
console.log('群怪(其他):', texts.filter(t => t === '群怪').length >= 1 ? 'ok' : 'FAIL');
console.log('机制名在 title:', result.labels.some(l => l.title === '困兽犹斗' || l.title === '祸不单行') ? 'ok' : 'FAIL');
const sw = await page.evaluate(() => document.documentElement.scrollWidth);
console.log('无溢出:', sw <= 375 ? 'ok' : 'FAIL sw=' + sw);
await browser.close();
