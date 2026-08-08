// 验证2：分析弹窗层级 + mine 趋势图溢出（独立会话，先隐藏广告）
import { chromium } from 'playwright';

const browser = await chromium.launch();
let failures = 0;
const check = (name, cond, extra = '') => {
    console.log((cond ? 'ok   ' : 'FAIL ') + name + (extra ? ' — ' + extra : ''));
    if (!cond) failures++;
};

const hideAd = page => page.evaluate(() => { const a = document.querySelector('.ad-float'); if (a) a.style.display = 'none'; });

// --- 分析弹窗层级 ---
{
    const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
    await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
    await hideAd(page);
    await page.waitForSelector('.ranking-row-mobile', { timeout: 15000 });
    await page.locator('.ranking-row-mobile').first().click();
    await page.waitForSelector('.prm-tabs', { timeout: 8000 });
    await page.click('.prm-actions .zone-sa-btn');
    await page.waitForTimeout(1500);
    const modalInfo = await page.evaluate(() => {
        const modals = [...document.querySelectorAll('.modal')].map(m => ({
            z: getComputedStyle(m).zIndex,
            hasSa: !!m.querySelector('.sa-zone-title'),
            hasTabs: !!m.querySelector('.prm-tabs')
        }));
        return modals;
    });
    const saM = modalInfo.find(m => m.hasSa);
    const prmM = modalInfo.find(m => m.hasTabs);
    check('PlayerRankModal 在 SaModal 下层 (z)', saM && prmM && Number(saM.z) > Number(prmM.z), JSON.stringify(modalInfo));
    await page.close();
}

// --- mine 趋势图溢出 ---
{
    const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
    await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
    await hideAd(page);
    await page.waitForTimeout(1200);
    await page.evaluate(() => {
        const monday = new Date();
        monday.setHours(0, 0, 0, 0);
        const samples = [];
        for (let h = 0; h < 8; h++) {
            samples.push({ t: monday.getTime() + h * 3600000, total: 20000000 + h * 3000000, zones: [7000000 + h * 1000000, 6000000 + h * 1000000, 7000000 + h * 1000000] });
        }
        localStorage.setItem('my_wz_today_samples', JSON.stringify(samples));
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await hideAd(page);
    await page.waitForTimeout(1200);
    await page.click('.nav-btn:has-text("我的")');
    await page.waitForTimeout(3500);
    const doc = await page.evaluate(() => {
        const iw = window.innerWidth;
        return {
            sw: document.documentElement.scrollWidth,
            iw,
            curveCharts: [...document.querySelectorAll('.curve-chart')].map(c => { const r = c.getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right), w: Math.round(r.width) }; }),
            legends: [...document.querySelectorAll('.chart-legend')].map(l => ({ h: Math.round(l.getBoundingClientRect().height) }))
        };
    });
    check('mine 趋势图不溢出', !(doc.sw > doc.iw + 1) && doc.curveCharts.every(c => c.r <= doc.iw + 1 && c.l >= -1), JSON.stringify(doc));
    check('legend 换行正常（多行）', doc.legends.some(l => l.h > 24), JSON.stringify(doc.legends));
    await page.close();
}

await browser.close();
console.log(failures ? `\n${failures} 项失败` : '\n全部通过');
process.exit(failures ? 1 : 0);
