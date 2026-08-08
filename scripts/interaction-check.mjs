// scripts/interaction-check.mjs — 375px 交互冒烟（临时脚本）
// 用真实用户行为验证：goto 首页 → 点击导航切换各页
import { chromium } from 'playwright';

const base = process.argv[2] || 'http://localhost:4173';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
let failures = 0;
const check = (name, cond) => {
    if (cond) console.log(`ok   ${name}`);
    else { failures++; console.log(`FAIL ${name}`); }
};
const waitFor = async (sel, timeout = 8000) => {
    try { await page.waitForSelector(sel, { timeout, state: 'attached' }); return true; }
    catch { return false; }
};
const gotoPage = async label => {
    await page.click(`.nav-btn:has-text("${label}")`);
    await page.waitForTimeout(300);
};

// 1. 排行榜页：紧凑行渲染 + 行点击 → PlayerRankModal
await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
await waitFor('.ranking-row-mobile');
const mobileRows = await page.locator('.ranking-row-mobile').count();
check(`紧凑行渲染 (rows=${mobileRows})`, mobileRows > 0);
if (mobileRows > 0) {
    await page.locator('.ranking-row-mobile').first().click();
    const prmOpen = await waitFor('.prm-tabs');
    check('行点击 → PlayerRankModal 三区 tab', prmOpen);
    if (prmOpen) {
        await page.locator('.modal-close').click();
        await page.waitForTimeout(300);
    }
}
// 2. 筛选折叠面板
check('筛选折叠面板', await waitFor('.mobile-filter-toggle'));
await page.locator('.mobile-filter-toggle').click();
check('筛选展开（区筛选块）', await waitFor('.mobile-filter-zone'));

// 3. 玩家页：搜索框
await gotoPage('玩家查询');
check('玩家页搜索框', await waitFor('.search-box input'));

// 4. PPC 页：boss 卡 + 榜单行
await gotoPage('幻痛囚笼');
check('PPC boss 卡', await waitFor('.ppc-boss-card'));
check('PPC 榜单行 ppc-row', await waitFor('.ppc-row'));

// 5. 我的页：引导
await gotoPage('我的');
check('我的页设置引导', await waitFor('.setup-guide'));

await browser.close();
if (failures > 0) { console.log(`\n${failures} 项失败`); process.exit(1); }
console.log('\n交互冒烟全部通过');
