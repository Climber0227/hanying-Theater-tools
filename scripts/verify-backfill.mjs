// 验证：旧历史记录机制标签自动补齐（按周请求 API）
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
// 注入无标签的旧记录（含当前周 + 前几周；week 为绝对周号，范围 488~582）
await page.evaluate(() => {
    localStorage.setItem('my_wz_scores', JSON.stringify([
        { week: 582, groupName: '传奇', groupLevel: '80-120', zones: [{ name: '火焰轮回', score: 10000000, team: [] }], total: 10000000, totalRank: 0, totalDiff: 0, timestamp: Date.now() },
        { week: 580, groupName: '传奇', groupLevel: '80-120', zones: [{ name: '空域浮台', score: 9000000, team: [] }], total: 9000000, totalRank: 0, totalDiff: 0, timestamp: Date.now() - 14 * 86400000 }
    ]));
});
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
await page.evaluate(() => { const a = document.querySelector('.ad-float'); if (a) a.style.display = 'none'; });
await page.click('.nav-btn:has-text("我的")');
await page.waitForTimeout(6000); // 等待按周请求完成
const result = await page.evaluate(() => ({
    tags: [...document.querySelectorAll('.score-cell-mech')].map(t => t.innerText),
    stored: JSON.parse(localStorage.getItem('my_wz_scores')).map(s => ({ week: s.week, z0: { mech: s.zones[0].mech, monster: s.zones[0].monster, weather: s.zones[0].weather } }))
}));
console.log('渲染标签:', JSON.stringify(result.tags));
console.log('localStorage 已写回:', JSON.stringify(result.stored, null, 1));
console.log('标签补齐:', result.tags.length >= 2 ? 'ok' : 'FAIL');
console.log('含机制名:', result.tags.some(t => t.includes('困兽犹斗') || t.includes('祸不单行') || t.includes('围剿')) ? 'ok' : 'FAIL');
console.log('含怪数:', result.tags.some(t => t.includes('单怪') || t.includes('双怪') || t.includes('群怪')) ? 'ok' : 'FAIL');
console.log('含天气:', result.tags.some(t => /[^·\s]+/.test(t.split('·').pop())) ? 'ok' : 'FAIL');
await browser.close();
