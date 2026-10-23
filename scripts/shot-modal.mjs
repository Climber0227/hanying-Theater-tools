// 截「分数分布」弹窗（桌面 / 手机），用于确认替换 Recharts 后的观感
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4173';
const wz = JSON.parse(fs.readFileSync('docs/perf/fixture-warzone-16.json', 'utf8'));
const PIXEL = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
);
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch({ channel: 'chrome' });

async function shot(viewport, dpr, out, mobile) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile });
    const page = await ctx.newPage();
    await page.route('https://assets.huaxu.app/**', r => r.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }));
    await page.route('https://api.huaxu.app/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(wz) }));
    await page.route('**/api/visit', r => r.fulfill({ status: 200, body: '{"count":1}' }));
    await page.goto(BASE + '/#/warzone', { waitUntil: 'load' });
    await page.waitForFunction(
        () => document.querySelectorAll('.ranking-row').length >= 5 && !document.querySelector('.skeleton-row'),
        null,
        { timeout: 30000 }
    );
    await page.addStyleTag({ content: '.ad-float,.corner-feedback{display:none!important}' });
    await page.locator('.tool-btn').first().click();
    await page.waitForSelector('.bracket-row', { timeout: 15000 });
    await sleep(500);
    await page.screenshot({ path: out });
    console.log('->', out);
    await ctx.close();
}

await shot({ width: 1440, height: 900 }, 2, 'docs/ui-audit/v2/modal-bracket-desktop.png', false);
await shot({ width: 390, height: 844 }, 3, 'docs/ui-audit/v2/modal-bracket-mobile.png', true);
await browser.close();
