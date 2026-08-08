// scripts/mobile-check.mjs
// 用法：node scripts/mobile-check.mjs [baseUrl]  （默认 http://localhost:4173，需先 npm run preview）
// 注意：hash 导航是 same-document（React 不重挂载），因此先加载无 hash 首页再点击导航按钮进入各页
import { chromium } from 'playwright';

const base = process.argv[2] || 'http://localhost:4173';
const NAV_LABELS = { '': null, '#/player': '玩家查询', '#/ppc': '幻痛囚笼', '#/mine': '我的', '#/changelog': '更新日志' };
const VIEWPORTS = [
    { name: 'mobile-375', width: 375, height: 812 },
    { name: 'desktop-1440', width: 1440, height: 900 }
];

const browser = await chromium.launch();
let failures = 0;
for (const vp of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    for (const [hash, label] of Object.entries(NAV_LABELS)) {
        // 每次用带时间戳的 URL 强制完整导航（避开 same-document hash 导航）
        await page.goto(`${base}/?v=${Date.now()}${Math.random()}`, { waitUntil: 'domcontentloaded' });
        if (label) {
            await page.click(`.nav-btn:has-text("${label}")`);
            await page.waitForTimeout(600);
        }
        const result = await page.evaluate(() => {
            const dw = document.documentElement.scrollWidth;
            const iw = window.innerWidth;
            return { dw, iw, overflow: dw > iw + 1 };
        });
        const tag = `${vp.name} ${hash || '/'}`;
        if (result.overflow) {
            failures++;
            console.log(`FAIL ${tag}: scrollWidth=${result.dw} > innerWidth=${result.iw}`);
        } else {
            console.log(`ok   ${tag}: ${result.dw}px`);
        }
    }
    await page.close();
}
await browser.close();
if (failures > 0) {
    console.log(`\n${failures} 个页面存在横向溢出`);
    process.exit(1);
}
console.log('\n全部页面无横向溢出');
