// 调试：mine 页趋势图为何不渲染
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
page.on('pageerror', e => console.log('PAGE_ERR:', String(e).slice(0, 200)));
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
await page.waitForTimeout(4000);
const info = await page.evaluate(() => ({
    charts: document.querySelectorAll('.curve-chart').length,
    svgs: document.querySelectorAll('.curve-svg').length,
    trendGrid: document.querySelectorAll('.trend-grid').length,
    empties: [...document.querySelectorAll('.team-empty')].map(e => e.innerText.slice(0, 30)),
    sections: [...document.querySelectorAll('.mine-section h3')].map(h => h.innerText),
    isMobile: matchMedia('(max-width: 700px)').matches
}));
console.log(JSON.stringify(info, null, 1));
await browser.close();
