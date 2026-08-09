// 验证：折线从左到右平滑绘制（dashoffset 渐进变化 + 第二张图错峰）——桌面视口（手机端趋势图在弹窗内）
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
await page.evaluate(() => {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const samples = [];
    for (let h = 0; h < 12; h++) {
        samples.push({ t: dayStart.getTime() + (8 + h) * 3600000, total: 20000000 + h * 3000000, zones: [7000000 + h * 1000000, 6000000 + h * 1000000, 7000000 + h * 1000000] });
    }
    localStorage.setItem('my_wz_today_samples', JSON.stringify(samples));
});
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
await page.evaluate(() => { const a = document.querySelector('.ad-float'); if (a) a.style.display = 'none'; });
await page.click('.nav-btn:has-text("我的")');
await page.waitForTimeout(2000);
await page.waitForSelector('.curve-svg', { timeout: 15000, state: 'attached' });
await page.waitForTimeout(300);
// 采样折线 dashoffset 变化过程
const track = [];
for (let k = 0; k < 8; k++) {
    const state = await page.evaluate(() => {
        const charts = [...document.querySelectorAll('.curve-chart')];
        return charts.map(c => {
            const line = c.querySelector('path'); // 第一个 path = 区域填充，折线在后续
            const all = [...c.querySelectorAll('path')];
            const linePath = all.find(p => { const s = getComputedStyle(p); return s.strokeDasharray !== 'none' && s.stroke !== 'none'; });
            const s = linePath ? getComputedStyle(linePath) : null;
            return { offset: s ? s.strokeDashoffset : 'NA' };
        });
    });
    track.push({ t: k * 500, charts: state });
    await page.waitForTimeout(500);
}
const first = track[1].charts[0].offset;
const last = track[track.length - 1].charts[0].offset;
const first2 = track[1].charts[1] ? track[1].charts[1].offset : 'NA';
console.log('第一张图 dashoffset: 开始时', first, '→ 结束时', last);
console.log('第二张图开始时(错峰):', first2);
console.log('第一张图渐进绘制:', first !== last ? 'ok' : 'FAIL');
console.log('第二张图错峰(起步晚):', track[1].charts[1] && first2 !== last ? 'ok' : 'FAIL', JSON.stringify(track.map(x => x.charts[1] && x.charts[1].offset)));
const dots = await page.evaluate(() => document.querySelectorAll('.curve-chart circle').length);
console.log('数据点渲染:', dots > 0 ? 'ok' : 'FAIL', 'dots=' + dots);
await browser.close();
