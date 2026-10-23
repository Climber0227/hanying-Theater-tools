// 线上验证：站点图标是否真的加载成功（导航 + 加载页背景 + favicon 声明）
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'https://jiatenghui.icu';
const HIDE = '.ad-float{display:none!important}.corner-feedback{display:none!important}';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const out = {};

// 1) 禁用 JS：只剩加载页，检查背景图请求是否 200
{
  const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const hits = [];
  page.on('response', (r) => {
    if (r.url().includes('/img/brand-')) hits.push({ url: r.url(), status: r.status(), type: r.headers()['content-type'] });
  });
  await page.goto(BASE, { waitUntil: 'commit', timeout: 60000 });
  await page.waitForSelector('#boot', { state: 'visible', timeout: 60000 });
  await page.waitForTimeout(1500);
  const box = await page.locator('.boot-mark').boundingBox();
  const bg = await page.locator('.boot-mark').evaluate((el) => getComputedStyle(el).backgroundImage);
  out.boot = { markBox: box, backgroundImage: bg, requests: hits };
  await page.screenshot({ path: 'docs/ui-audit/v2/boot-icon-live.png' });
  await ctx.close();
}

// 2) 正常打开：导航图标 naturalWidth
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(BASE, { waitUntil: 'load', timeout: 90000 });
  await page.addStyleTag({ content: HIDE });
  await page.waitForFunction(
    () => {
      const img = document.querySelector('.nav-logo img');
      return img && img.complete;
    },
    { timeout: 60000 }
  );
  const nav = await page.locator('.nav-logo img').evaluate((img) => ({
    src: img.getAttribute('src'),
    naturalWidth: img.naturalWidth,
    naturalHeight: img.naturalHeight,
    rendered: { w: img.clientWidth, h: img.clientHeight },
  }));
  const hrefs = await page.$$eval('link[rel="icon"],link[rel="apple-touch-icon"]', (els) =>
    els.map((e) => ({ rel: e.rel, href: e.getAttribute('href'), sizes: e.getAttribute('sizes') }))
  );
  out.nav = { ...nav, iconLinks: hrefs, pageErrors: errs };
  await page.locator('.nav-brand').screenshot({ path: 'docs/ui-audit/v2/nav-brand-live.png' });
  await page.screenshot({ path: 'docs/ui-audit/v2/home-icon-live.png' });
  await ctx.close();
}

// 3) 手机端
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'load', timeout: 90000 });
  await page.addStyleTag({ content: HIDE });
  await page.waitForFunction(
    () => {
      const img = document.querySelector('.nav-logo img');
      return img && img.complete;
    },
    { timeout: 60000 }
  );
  const nav = await page.locator('.nav-logo img').evaluate((img) => ({ naturalWidth: img.naturalWidth, rendered: { w: img.clientWidth, h: img.clientHeight } }));
  const docW = await page.evaluate(() => document.documentElement.scrollWidth);
  out.mobile = { ...nav, docW };
  await page.screenshot({ path: 'docs/ui-audit/v2/home-icon-live-mobile.png' });
  await ctx.close();
}

await browser.close();
fs.writeFileSync('docs/perf/icon-live.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
