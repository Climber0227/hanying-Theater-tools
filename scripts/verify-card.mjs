// 验证：本周分数卡片子区名渲染（熵钟异数 → 猩红冰原/岩流深壑）
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
await page.evaluate(() => {
    localStorage.setItem('my_wz_last_sync', JSON.stringify({
        area: {
            areaInfo: {
                totalPoint: 30000000, totalChallengeTimes: 3,
                stageFightInfoList: [
                    { stageName: '火焰轮回', point: 10000000, totalNum: 3, npcGroup: 12, areaBuffFightInfoList: [{}] },
                    { stageName: '空域浮台', point: 10000000, totalNum: 3, npcGroup: 12, areaBuffFightInfoList: [{}] },
                    { stageName: '熵钟异数', point: 10000000, totalNum: 3, npcGroup: 12, areaBuffFightInfoList: [{}] }
                ]
            },
            groupName: '传奇', groupLevel: '80-120'
        },
        ppc: { prisonerCage: { totalPoint: 9000000, totalChallengeTimes: 3, bossFightInfoList: [] } },
        roleId: 'test', serverId: 'test'
    }));
});
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
await page.evaluate(() => { const a = document.querySelector('.ad-float'); if (a) a.style.display = 'none'; });
await page.click('.nav-btn:has-text("我的")');
await page.waitForTimeout(4000);
const result = await page.evaluate(() => ({
    zoneNames: [...document.querySelectorAll('.week-zone-name')].map(z => z.innerText)
}));
console.log('本周分数区名:', JSON.stringify(result.zoneNames, null, 1));
const ent = result.zoneNames.find(t => t.includes('熵钟异数'));
console.log('熵钟异数卡片含子区名:', ent && ent.includes('猩红冰原') && ent.includes('岩流深壑') ? 'ok' : 'FAIL', JSON.stringify(ent));
const sw = await page.evaluate(() => document.documentElement.scrollWidth);
console.log('无溢出:', sw <= 375 ? 'ok' : 'FAIL sw=' + sw);
await browser.close();
