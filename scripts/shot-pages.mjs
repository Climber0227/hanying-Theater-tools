import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const BASE = process.env.BASE_URL || 'http://127.0.0.1:5199';
const OUT = 'docs/ui-audit/v2';
const HIDE = '.ad-float{display:none!important}.corner-feedback{display:none!important}';
await mkdir(OUT, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
for (const page of ['player', 'ppc', 'mine', 'changelog']) {
    await p.goto(`${BASE}/#/${page}`, { waitUntil: 'domcontentloaded' });
    await p.addStyleTag({ content: HIDE });
    await p.waitForTimeout(2200);
    await p.addStyleTag({ content: HIDE });
    await p.screenshot({ path: `${OUT}/page-${page}.png` });
    console.log(page, await p.evaluate(() => ({ h: document.documentElement.scrollHeight, w: document.documentElement.scrollWidth })));
}
await b.close();
