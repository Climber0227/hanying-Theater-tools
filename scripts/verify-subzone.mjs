// 验证：熵钟异数子区名（猩红冰原/岩流深壑）渲染
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
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
await page.waitForTimeout(10000);
const result = await page.evaluate(() => ({
    zoneTexts: [...document.querySelectorAll('.score-cell-zone')].map(z => z.innerText),
    stored: JSON.parse(localStorage.getItem('my_wz_scores'))[0].zones.map(z => ({ name: z.name, sub: z.subZones, monster: z.monster }))
}));
console.log('行内区名:', JSON.stringify(result.zoneTexts, null, 1));
console.log('存储:', JSON.stringify(result.stored, null, 1));
const ent = result.zoneTexts.find(t => t.includes('熵钟异数'));
console.log('熵钟异数含子区名:', ent && ent.includes('猩红冰原') && ent.includes('岩流深壑') ? 'ok' : 'FAIL', JSON.stringify(ent));
console.log('火焰轮回无子区:', result.zoneTexts.some(t => t === '火焰轮回') ? 'ok' : 'FAIL');
const sw = await page.evaluate(() => document.documentElement.scrollWidth);
console.log('无溢出:', sw <= 375 ? 'ok' : 'FAIL sw=' + sw);
await browser.close();
