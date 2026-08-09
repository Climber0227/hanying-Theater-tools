// 验证：我的页顺序（引导→本周分数→战区趋势→幻痛→账号→关注）+ 引导锚点仍有效
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
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
await page.waitForTimeout(2500);
const info = await page.evaluate(() => {
    const blocks = [];
    document.querySelectorAll('.setup-guide, .week-score-card, .mine-section').forEach(el => {
        const r = el.getBoundingClientRect();
        const label = el.classList.contains('setup-guide') ? '引导'
            : el.classList.contains('week-score-card') ? '本周分数'
            : el.querySelector('h3')?.innerText || '未知';
        blocks.push({ label, y: Math.round(r.top) });
    });
    return blocks;
});
console.log('页面区块顺序:', JSON.stringify(info, null, 1));
// 验证顺序
const order = info.map(b => b.label);
const exp = ['引导', '本周分数', '2我的战区', '3我的幻痛', '1账号 · 库街区', '4关注列表'];
console.log('顺序正确:', JSON.stringify(order) === JSON.stringify(exp) ? 'ok' : 'FAIL', JSON.stringify(order));
// 引导锚点：点击第3步 → 应跳转到 #mine-scores
await page.evaluate(() => { document.querySelector('.guide-step:nth-child(3)')?.scrollIntoView(); });
const anchor3 = await page.evaluate(() => !!document.getElementById('mine-scores'));
const anchor1 = await page.evaluate(() => !!document.getElementById('mine-account'));
console.log('锚点保留(#mine-scores/#mine-account):', anchor3 && anchor1 ? 'ok' : 'FAIL');
await browser.close();
