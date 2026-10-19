// 验证：隐藏角色详情 → 历届阵容反推（真实接口，玩家 14427541「新綠」角色详情已隐藏）
// 运行前需先启动 dev server：npm run dev
import { chromium } from 'playwright';

const PLAYER_ID = '14427541';
const PLAYER_NAME = '新綠';
const BASE = 'http://localhost:5173/';

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.setDefaultTimeout(240000);

const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

const t0 = Date.now();
const lap = msg => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${msg}`);

await page.goto(BASE + '#/player', { waitUntil: 'domcontentloaded' });
await page.evaluate(() => { const a = document.querySelector('.ad-float'); if (a) a.remove(); });
await page.waitForSelector('input[placeholder="输入玩家ID"]');
lap('进入玩家查询页');

await page.fill('input[placeholder="输入玩家ID"]', PLAYER_ID);
await page.press('input[placeholder="输入玩家ID"]', 'Enter');
await page.waitForSelector(`.player-details h2:has-text("${PLAYER_NAME}")`);
lap(`玩家档案已加载（${PLAYER_NAME}）`);

const hint = await page.locator('.roster-hint').first().innerText();
console.log('提示条:', hint.replace(/\n/g, ' | '));

await page.click('.roster-hint-btn');
lap('打开反推弹窗');

await page.waitForSelector('.roster-summary', { timeout: 240000 });
lap('反推结果已返回');

const summary = await page.evaluate(() => ({
    stats: [...document.querySelectorAll('.roster-stat b')].map(b => b.innerText.replace(/\n/g, ' ')),
    labels: [...document.querySelectorAll('.roster-stat span')].map(s => s.innerText),
    cards: document.querySelectorAll('.roster-card').length,
    hiddenCards: document.querySelectorAll('.roster-card.is-hidden-char').length,
    openCards: document.querySelectorAll('.roster-card.is-open').length,
    firstNames: [...document.querySelectorAll('.roster-card-name')].slice(0, 5).map(n => n.innerText.replace(/\n/g, '·')),
    firstMeta: [...document.querySelectorAll('.roster-card-meta')].slice(0, 3).map(n => n.innerText.replace(/\n/g, ' ')),
    sub: [...document.querySelectorAll('.roster-card-sub')].slice(0, 3).map(n => n.innerText),
    note: document.querySelector('.roster-note')?.innerText || '',
    rankChips: [...document.querySelectorAll('.roster-rank-chip')].map(c => c.innerText.replace(/\n/g, ' '))
}));
console.log('统计:', JSON.stringify(summary.stats), JSON.stringify(summary.labels));
console.log('卡片:', summary.cards, '隐藏:', summary.hiddenCards, '已公开:', summary.openCards);
console.log('前 5 角色:', JSON.stringify(summary.firstNames));
console.log('前 3 元信息:', JSON.stringify(summary.firstMeta));
console.log('前 3 出场:', JSON.stringify(summary.sub));
console.log('阶级分布:', JSON.stringify(summary.rankChips));

// 切到「隐藏角色」筛选
const tabs = await page.locator('.roster-tabs .team-tab').allInnerTexts();
console.log('筛选页签:', JSON.stringify(tabs));
await page.click('.roster-tabs .team-tab:has-text("隐藏角色")');
await page.waitForTimeout(200);
const hiddenOnly = await page.evaluate(() => ({
    cards: document.querySelectorAll('.roster-card').length,
    open: document.querySelectorAll('.roster-card.is-open').length
}));
console.log('仅隐藏筛选后:', JSON.stringify(hiddenOnly));

// 展开第一张卡看详情
await page.locator('.roster-card').first().click();
const detail = await page.locator('.roster-card.is-expanded .roster-detail').first().innerText();
console.log('展开详情:', detail.replace(/\n/g, ' | '));

// 关闭弹窗，检查角色列表里的反推徽章
await page.click('.modal-close');
await page.waitForTimeout(400);
const applied = await page.evaluate(() => ({
    inferred: document.querySelectorAll('.character-inferred').length,
    tags: [...document.querySelectorAll('.character-inferred .char-inferred-tag')].length,
    sample: [...document.querySelectorAll('.character-inferred')].slice(0, 3).map(c => c.innerText.replace(/\n/g, ' ')),
    header: document.querySelector('.characters-section h3')?.innerText.replace(/\n/g, ' ')
}));
console.log('角色列表反推徽章:', JSON.stringify(applied));

const sw = await page.evaluate(() => document.documentElement.scrollWidth);
console.log('页面宽度:', sw, sw <= 1280 ? 'ok' : 'overflow');

console.log('页面错误:', errors.length ? JSON.stringify(errors) : 'none');

// 结果断言
const ok = summary.cards > 0 && summary.hiddenCards > 0 && applied.inferred > 0 && errors.length === 0;
console.log('RESULT:', ok ? 'PASS' : 'FAIL');

await browser.close();
process.exit(ok ? 0 : 1);
