// UI 现状截图审计：线上站点，桌面 + 手机，各页面
// 用法：node scripts/ui-audit.mjs [baseUrl]
import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE = process.argv[2] || 'https://jiatenghui.icu';
const OUT = 'docs/ui-audit/current';
await fs.mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const logs = [];

async function shoot(page, name, { full = false } = {}) {
    await page.waitForTimeout(1200);
    // 记录 UI 事实
    const info = await page.evaluate(() => {
        const css = el => (el ? getComputedStyle(el) : null);
        const body = css(document.body);
        const h1 = document.querySelector('h1');
        const nav = document.querySelector('.nav');
        return {
            title: document.title,
            h1: h1 ? h1.textContent.trim() : null,
            font: body.fontFamily,
            bodyBg: body.backgroundImage.slice(0, 120),
            nav: nav ? { h: Math.round(nav.getBoundingClientRect().height), bg: css(nav).backgroundColor } : null,
            scrollW: document.documentElement.scrollWidth,
            innerW: window.innerWidth,
            scrollH: document.documentElement.scrollHeight,
            imgs: document.querySelectorAll('img').length,
            hero: (() => { const e = document.querySelector('.header'); return e ? { h: Math.round(e.getBoundingClientRect().height) } : null; })()
        };
    });
    logs.push({ name, ...info });
    const path = `${OUT}/${name}.png`;
    await page.screenshot({ path, fullPage: full });
    console.log('shot', path, JSON.stringify(info));
}

// ---------- 桌面 ----------
{
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('.ranking-row, .ranking-table', { timeout: 45000 }).catch(() => {});
    await page.waitForTimeout(2500);

    await shoot(page, 'desktop-warzone', { full: false });
    await shoot(page, 'desktop-warzone-full', { full: true });

    // 隐藏广告后截一张，观察内容本身
    await page.evaluate(() => { const a = document.querySelector('.ad-float'); if (a) a.style.display = 'none'; });
    await shoot(page, 'desktop-warzone-noad');

    await page.click('.nav-btn:has-text("玩家查询")');
    await page.waitForTimeout(800);
    await shoot(page, 'desktop-player-empty');

    await page.fill('input[placeholder="输入玩家ID"]', '18152213');
    await page.click('.search-box button');
    await page.waitForSelector('.player-profile', { timeout: 45000 }).catch(() => {});
    await page.waitForTimeout(3000);
    await shoot(page, 'desktop-player-loaded', { full: false });
    await shoot(page, 'desktop-player-full', { full: true });

    await page.click('.nav-btn:has-text("幻痛囚笼")');
    await page.waitForTimeout(3500);
    await shoot(page, 'desktop-ppc', { full: false });

    await page.click('.nav-btn:has-text("我的")');
    await page.waitForTimeout(4000);
    await shoot(page, 'desktop-mine', { full: false });
    await shoot(page, 'desktop-mine-full', { full: true });

    await page.click('.nav-btn:has-text("更新日志")');
    await page.waitForTimeout(2000);
    await shoot(page, 'desktop-changelog', { full: true });

    await ctx.close();
}

// ---------- 手机 ----------
{
    const ctx = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    });
    const page = await ctx.newPage();
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('.ranking-row, .ranking-table', { timeout: 45000 }).catch(() => {});
    await page.waitForTimeout(2500);
    await shoot(page, 'mobile-warzone');
    await page.evaluate(() => { const a = document.querySelector('.ad-float'); if (a) a.style.display = 'none'; });
    await shoot(page, 'mobile-warzone-noad');
    await shoot(page, 'mobile-warzone-full', { full: true });

    await page.click('.nav-btn:has-text("我的")');
    await page.waitForTimeout(4000);
    await shoot(page, 'mobile-mine');
    await shoot(page, 'mobile-mine-full', { full: true });

    await ctx.close();
}

await browser.close();
await fs.writeFile(`${OUT}/metrics.json`, JSON.stringify(logs, null, 2));
console.log('done, metrics saved');
