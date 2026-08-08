// 验证：CurveModal 加固后无渲染崩溃（hover 越界/数据切换）
import { chromium } from 'playwright';

const browser = await chromium.launch();
let failures = 0;
const check = (name, cond, extra = '') => {
    console.log((cond ? 'ok   ' : 'FAIL ') + name + (extra ? ' — ' + extra : ''));
    if (!cond) failures++;
};

// --- 桌面：注入采样数据，打开趋势弹窗，全区域移动鼠标（含图外/边界） ---
{
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    // 注入本周曲线采样：从页面读真实玩家 ID，覆盖近 6 个 activity，同时塞入异常样本（null/坏结构）测防御
    await page.evaluate(() => {
        const ids = [...document.querySelectorAll('.player-id-text')].slice(0, 5).map(e => e.innerText.replace('ID: ', '').trim());
        const dayStart = new Date();
        dayStart.setHours(0, 0, 0, 0);
        const samples = [];
        for (let h = 0; h < 12; h++) {
            const p = {};
            ids.forEach(pid => { p[pid] = { n: '玩家' + pid, z: [1000000 + h * 100000, 900000 + h * 100000, 1100000 + h * 100000], t: 3000000 + h * 300000 }; });
            samples.push({ t: dayStart.getTime() + (8 + h) * 3600000, p });
        }
        samples.push(null); // 异常样本：验证 filter 防御
        samples.push({ t: dayStart.getTime() + 8 * 3600000, p: null }); // 异常样本
        for (let act = 577; act <= 583; act++) {
            localStorage.setItem('huaxu_wz_curve_16_' + act, JSON.stringify({ samples: [...samples] }));
        }
    });
    await page.evaluate(() => { const a = document.querySelector('.ad-float'); if (a) a.style.display = 'none'; });
    await page.waitForSelector('.ranking-row', { timeout: 15000 });
    // 桌面趋势按钮 hover 浮现：先 hover 行，再点按钮
    await page.locator('.ranking-row').first().hover();
    await page.waitForTimeout(400);
    await page.locator('.ranking-row .zone-trend-btn').first().click();
    await page.waitForTimeout(2500);
    const chartCount = await page.locator('.curve-chart').count();
    check('趋势弹窗打开（2 图）', chartCount === 2, `count=${chartCount}`);
    if (chartCount >= 1) {
        // 在 SVG 上大幅移动鼠标（模拟 hover 边界计算）
        const svg = page.locator('.curve-svg').first();
        const box = await svg.boundingBox();
        for (let k = 0; k < 40; k++) {
            const x = box.x + Math.random() * box.width;
            const y = box.y + Math.random() * box.height;
            await page.mouse.move(x, y);
        }
        await page.waitForTimeout(600);
        // 移动到图外边缘
        await page.mouse.move(box.x - 5, box.y - 5);
        await page.mouse.move(box.x + box.width + 5, box.y + box.height + 5);
        await page.waitForTimeout(400);
    }
    check('桌面 hover 无崩溃', errors.length === 0, JSON.stringify(errors));
    await page.close();
}

// --- 手机：趋势弹窗滑动 ---
{
    const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await page.evaluate(() => { const a = document.querySelector('.ad-float'); if (a) a.style.display = 'none'; });
    await page.waitForSelector('.ranking-row-mobile', { timeout: 15000 });
    await page.locator('.ranking-row-mobile').first().click();
    await page.waitForSelector('.prm-tabs', { timeout: 8000 });
    await page.click('.prm-actions .zone-trend-btn');
    await page.waitForTimeout(2500);
    const chartCount = await page.locator('.curve-chart').count();
    check('手机趋势弹窗打开', chartCount === 2, `count=${chartCount}`);
    if (chartCount >= 1) {
        const svg = page.locator('.curve-svg').first();
        const box = await svg.boundingBox();
        // 触摸滑动
        for (let k = 0; k < 10; k++) {
            await page.touchscreen.tap(box.x + Math.random() * box.width, box.y + Math.random() * box.height);
        }
        await page.waitForTimeout(600);
    }
    check('手机滑动无崩溃', errors.length === 0, JSON.stringify(errors));
    await page.close();
}

await browser.close();
console.log(failures ? `\n${failures} 项失败` : '\n全部通过');
process.exit(failures ? 1 : 0);
