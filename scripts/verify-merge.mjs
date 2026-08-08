// 验证：服务端数据不全时本地补充（本周图不闪"暂无数据"）
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));

// 拦截 /api/curve：返回"仅今天 1 条"的服务端数据（模拟服务端采样不全）
await page.route('**/api/curve**', route => {
    route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'success', samples: [{ t: Date.now() - 3600000, zones: [1000000, 900000, 1100000], total: 3000000 }] })
    });
});

await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
// 本地注入：本周周一~今天多天样本（模拟用户本地历史）
await page.evaluate(() => {
    const ids = [...document.querySelectorAll('.player-id-text')].slice(0, 1).map(e => e.innerText.replace('ID: ', '').trim());
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const monday = dayStart.getTime() - (dayStart.getDay() + 6) % 7 * 86400000;
    const samples = [];
    for (let d = 0; d < 4; d++) {
        const p = {};
        ids.forEach(pid => { p[pid] = { n: '玩家' + pid, z: [1000000 + d * 100000, 900000 + d * 100000, 1100000 + d * 100000], t: 3000000 + d * 300000 }; });
        samples.push({ t: monday + d * 86400000 + 12 * 3600000, p });
    }
    localStorage.setItem('huaxu_wz_curve_16_582', JSON.stringify({ samples }));
});
await page.evaluate(() => { const a = document.querySelector('.ad-float'); if (a) a.style.display = 'none'; });
await page.waitForSelector('.ranking-row-mobile', { timeout: 15000 });
await page.locator('.ranking-row-mobile').first().click();
await page.waitForSelector('.prm-tabs', { timeout: 8000 });
await page.click('.prm-actions .zone-trend-btn');
await page.waitForTimeout(3500);
const info = await page.evaluate(() => ({
    charts: [...document.querySelectorAll('.curve-chart')].map(c => ({
        title: c.querySelector('.curve-chart-title')?.innerText,
        hasSvg: !!c.querySelector('.curve-svg'),
        empty: c.querySelector('.team-empty')?.innerText || ''
    }))
}));
console.log(JSON.stringify(info, null, 1));
const todayOk = info.charts[0] && info.charts[0].hasSvg;
const weekOk = info.charts[1] && info.charts[1].hasSvg;
console.log('今日图渲染:', todayOk ? 'ok' : 'FAIL');
console.log('本周图渲染(本地补充服务端):', weekOk ? 'ok' : 'FAIL', info.charts[1]?.empty || '');
console.log('无页面错误:', errors.length === 0 ? 'ok' : 'FAIL ' + JSON.stringify(errors));
await browser.close();
