// 验证：已有 mech/monster 但无 subZones 的旧记录也能补齐子区名
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
// 模拟上一版已补过 mech/monster 的记录（无 subZones 字段）
await page.evaluate(() => {
    localStorage.setItem('my_wz_scores', JSON.stringify([
        { week: 582, groupName: '传奇', groupLevel: '80-120', zones: [
            { name: '火焰轮回', score: 10000000, team: [], mech: '困兽犹斗', monster: '单怪' },
            { name: '空域浮台', score: 11000000, team: [], mech: '祸不单行', monster: '双怪' },
            { name: '熵钟异数', score: 12000000, team: [], mech: '困兽犹斗', monster: '单怪' }
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
console.log('行内区名:', JSON.stringify(result.zoneTexts));
console.log('存储:', JSON.stringify(result.stored, null, 1));
const ent = result.zoneTexts.find(t => t.includes('熵钟异数'));
console.log('熵钟异数已补子区名:', ent && ent.includes('猩红冰原') && ent.includes('岩流深壑') ? 'ok' : 'FAIL', JSON.stringify(ent));
await browser.close();
