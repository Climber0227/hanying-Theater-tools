// 验证：手机端趋势图收进弹窗 + 本周分数趋势按钮
import { chromium } from 'playwright';

const browser = await chromium.launch();
let failures = 0;
const check = (name, cond, extra = '') => {
    console.log((cond ? 'ok   ' : 'FAIL ') + name + (extra ? ' — ' + extra : ''));
    if (!cond) failures++;
};

const seedData = () => {
    const monday = new Date();
    monday.setHours(0, 0, 0, 0);
    const samples = [];
    for (let h = 0; h < 8; h++) {
        samples.push({ t: monday.getTime() + h * 3600000, total: 20000000 + h * 3000000, zones: [7000000 + h * 1000000, 6000000 + h * 1000000, 7000000 + h * 1000000] });
    }
    localStorage.setItem('my_wz_today_samples', JSON.stringify(samples));
    localStorage.setItem('my_wz_last_sync', JSON.stringify({
        area: {
            areaInfo: {
                totalPoint: 30000000,
                totalChallengeTimes: 3,
                stageFightInfoList: [
                    { stageName: '火焰轮回', point: 10000000, totalNum: 3, npcGroup: 12, areaBuffFightInfoList: [{}] },
                    { stageName: '空域浮台', point: 10000000, totalNum: 3, npcGroup: 12, areaBuffFightInfoList: [{}] },
                    { stageName: '熵钟异数', point: 10000000, totalNum: 3, npcGroup: 12, areaBuffFightInfoList: [{}] }
                ]
            },
            groupName: '传奇', groupLevel: '80-120'
        },
        ppc: { prisonerCage: { totalPoint: 9000000, totalChallengeTimes: 3, bossFightInfoList: [{ boss: { name: 'BossA' }, totalPoint: 3000000 }, { boss: { name: 'BossB' }, totalPoint: 3000000 }] } },
        roleId: 'test', serverId: 'test'
    }));
};

// --- 手机端 ---
{
    const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
    await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    await page.evaluate(seedData);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    await page.evaluate(() => { const a = document.querySelector('.ad-float'); if (a) a.style.display = 'none'; });
    await page.click('.nav-btn:has-text("我的")');
    await page.waitForTimeout(3500);

    const direct = await page.evaluate(() => document.querySelectorAll('.trend-grid:not(.trend-modal-grid)').length);
    check('手机端趋势图不直接展示', direct === 0, `direct=${direct}`);

    const btn = await page.locator('.week-trend-btn').count();
    check('本周分数内有趋势按钮', btn > 0);
    if (btn > 0) {
        await page.locator('.week-trend-btn').click();
        await page.waitForTimeout(1500);
        const modal = await page.evaluate(() => {
            const charts = [...document.querySelectorAll('.modal .curve-chart')].map(c => { const r = c.getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right), w: Math.round(r.width) }; });
            return {
                chartCount: charts.length,
                charts,
                sw: document.documentElement.scrollWidth,
                iw: window.innerWidth
            };
        });
        check('弹窗内 2 个趋势图', modal.chartCount === 2, `count=${modal.chartCount}`);
        check('弹窗内图表不溢出', modal.charts.every(c => c.r <= modal.iw + 1 && c.l >= -1), JSON.stringify(modal.charts));
        check('页面无横向溢出', !(modal.sw > modal.iw + 1), `sw=${modal.sw}`);
        // 关闭弹窗
        await page.locator('.modal-close').click();
        await page.waitForTimeout(400);
    }
    await page.close();
}

// --- 桌面端 ---
{
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    await page.evaluate(seedData);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    await page.evaluate(() => { const a = document.querySelector('.ad-float'); if (a) a.style.display = 'none'; });
    await page.click('.nav-btn:has-text("我的")');
    await page.waitForTimeout(3500);
    const desktop = await page.evaluate(() => ({
        direct: document.querySelectorAll('.trend-grid:not(.trend-modal-grid) .curve-chart').length,
        trendBtn: document.querySelectorAll('.week-trend-btn').length
    }));
    check('桌面端趋势图直接展示', desktop.direct === 2, `direct=${desktop.direct}`);
    check('桌面端无趋势按钮', desktop.trendBtn === 0);
    await page.close();
}

await browser.close();
console.log(failures ? `\n${failures} 项失败` : '\n全部通过');
process.exit(failures ? 1 : 0);
