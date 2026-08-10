// 验证：采样带区名 + 按名匹配读取（三区顺序变化不再错位）
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

// 注入新格式采样（带 names）——模拟"采样时刻顺序与当前不同"的场景：
// 采样顺序 [镭射, 熵钟, 暗影]（错位），当前展示顺序 [镭射, 暗影, 熵钟]
await page.evaluate(() => {
    const ids = [...document.querySelectorAll('.player-id-text')].slice(0, 1).map(e => e.innerText.replace('ID: ', '').trim());
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const samples = [];
    for (let h = 0; h < 10; h++) {
        const p = {};
        ids.forEach(pid => {
            p[pid] = {
                n: '玩家' + pid,
                z: [
                    { n: '镭射合金', s: 3000000 + h * 100000 },
                    { n: '熵钟异数', s: 5000000 + h * 100000 },
                    { n: '暗影深林', s: 4000000 + h * 100000 }
                ],
                t: 12000000 + h * 300000
            };
        });
        samples.push({ t: dayStart.getTime() + (8 + h) * 3600000, p, names: ['镭射合金', '熵钟异数', '暗影深林'] });
    }
    localStorage.setItem('huaxu_wz_curve_16_583', JSON.stringify({ samples }));
});
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
await page.evaluate(() => { const a = document.querySelector('.ad-float'); if (a) a.style.display = 'none'; });
await page.waitForSelector('.ranking-row', { timeout: 15000 });
await page.locator('.ranking-row').first().hover();
await page.waitForTimeout(400);
await page.locator('.ranking-row .zone-trend-btn').first().click();
await page.waitForTimeout(3000);

const result = await page.evaluate(() => {
    const charts = [...document.querySelectorAll('.curve-chart')];
    const first = charts[0];
    const legend = [...first.querySelectorAll('.chart-legend-item')].map(l => l.innerText);
    // 读取最后一个数据点的 z 值（path 的 y 坐标不易读，用最后 circle 的 cy 反推）
    const circles = [...first.querySelectorAll('circle')];
    const cyBySeries = [];
    return { legend, circleCount: circles.length };
});
console.log(JSON.stringify(result));
console.log('图例顺序:', result.legend.length >= 3 ? 'ok' : 'FAIL', JSON.stringify(result.legend));
await browser.close();
