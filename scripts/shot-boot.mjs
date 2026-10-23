// 截「首屏加载页」与「数据加载中骨架」两张图，并验证加载页会在 React 挂载后消失。
// 用法：node scripts/shot-boot.mjs   （先起 vite preview）
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4173/';
const OUT = 'docs/ui-audit/v2';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome' });
const results = {};

// 1) 加载页：把 JS 全部扣住不放，页面就停在 #boot 上
async function captureBoot(tag, viewport, dpr) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: dpr });
    const page = await ctx.newPage();
    const held = [];
    await page.route('**/*.js', route => { held.push(route); });
    // 模块脚本被扣住时 DOMContentLoaded 不会触发，只能等 HTML 提交 + 选择器出现
    await page.goto(BASE, { waitUntil: 'commit' });
    await page.waitForSelector('#boot', { state: 'visible' });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${OUT}/boot-${tag}.png` });
    const info = await page.evaluate(() => {
        const b = document.getElementById('boot');
        const tip = document.getElementById('boot-tip');
        return { bootVisible: !!b, tip: tip ? tip.textContent : null };
    });
    // 放行后验证加载页会自己消失
    for (const route of held) route.continue().catch(() => {});
    const gone = await page
        .waitForFunction(() => !document.getElementById('boot'), null, { timeout: 30000 })
        .then(() => true)
        .catch(() => false);
    await ctx.close();
    results[`boot-${tag}`] = { ...info, dismissedAfterMount: gone };
}

// 2) 数据骨架：接口请求一直挂着，看「等到数据」这一屏现在长什么样
async function captureSkeleton(tag, viewport, dpr) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: dpr });
    const page = await ctx.newPage();
    await page.route('**api.huaxu.app/**', () => { /* 永不响应 */ });
    await page.route('**/api/huaxu*', () => { /* 永不响应 */ });
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/skeleton-${tag}.png` });
    const info = await page.evaluate(() => ({
        bootGone: !document.getElementById('boot'),
        skeletonRows: document.querySelectorAll('.skeleton-row').length,
        zoneCardH: document.querySelector('.zone-card')?.getBoundingClientRect().height ?? 0,
        panelTop: document.querySelector('.rankings')?.getBoundingClientRect().top ?? 0,
        panelH: document.querySelector('.rankings')?.getBoundingClientRect().height ?? 0,
        scrollH: document.documentElement.scrollHeight
    }));
    await ctx.close();
    results[`skeleton-${tag}`] = info;
}

// 3) 数据到位后：量真实卡片高度，和骨架卡对比看有没有位移
async function captureLoaded(tag, viewport, dpr) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: dpr });
    const page = await ctx.newPage();
    const fixture = fs.readFileSync('docs/perf/fixture-warzone-16.json', 'utf8');
    // 注意顺序：Playwright 后注册的 route 优先，通配的兜底必须放在最前面
    await page.route('**api.huaxu.app/**', route => route.abort());
    await page.route('**/api/visit', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"visits":1}' }));
    await page.route('**/servers/cn/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"data":{}}' }));
    await page.route('**/servers/cn/warzone/**', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: fixture })
    );
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.ranking-row', { state: 'attached', timeout: 30000 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/loaded-${tag}.png` });
    const info = await page.evaluate(() => ({
        rows: document.querySelectorAll('.ranking-row').length,
        zoneCardH: document.querySelector('.zone-card')?.getBoundingClientRect().height ?? 0,
        panelTop: document.querySelector('.rankings')?.getBoundingClientRect().top ?? 0,
        scrollH: document.documentElement.scrollHeight
    }));
    await ctx.close();
    results[`loaded-${tag}`] = info;
}

await captureBoot('desktop', { width: 1440, height: 900 }, 2);
await captureBoot('mobile', { width: 390, height: 844 }, 3);
await captureSkeleton('desktop', { width: 1440, height: 900 }, 2);
await captureSkeleton('mobile', { width: 390, height: 844 }, 3);
await captureLoaded('desktop', { width: 1440, height: 900 }, 2);
await captureLoaded('mobile', { width: 390, height: 844 }, 3);

await browser.close();
fs.writeFileSync('docs/perf/boot-check.json', JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
