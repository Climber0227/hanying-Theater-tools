// 性能改造后的视觉复核：本地预览 + mock 接口（源站偶发 20s+ 不返回，不 mock 截不出来）
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4173';
const fx = {
    player: await readFile('docs/perf/fixture-player.json', 'utf8'),
    playerWz: await readFile('docs/perf/fixture-player-warzone.json', 'utf8'),
    wz: await readFile('docs/perf/fixture-warzone-16.json', 'utf8')
};

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = {};

async function shot(name, hash, { mobile = false, prepare } = {}) {
    const ctx = await browser.newContext({
        viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
        deviceScaleFactor: mobile ? 3 : 2,
        locale: 'zh-CN'
    });
    const page = await ctx.newPage();
    const reqs = { webp: 0, png: 0, failed: 0 };
    await page.route('https://api.huaxu.app/**', async r => {
        const p = new URL(r.request().url()).pathname;
        let body = '{"status":"success","data":{}}';
        if (/players\/\d+\/warzone$/.test(p)) body = fx.playerWz;
        else if (/players\/\d+$/.test(p)) body = fx.player;
        else if (p.includes('/warzone/current/')) body = fx.wz;
        r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body });
    });
    page.on('request', r => {
        const u = r.url();
        if (!u.includes('assets.huaxu.app')) return;
        if (/\.webp(\?|$)/i.test(u)) reqs.webp++;
        else if (/\.png(\?|$)/i.test(u)) reqs.png++;
    });
    page.on('requestfailed', r => { if (r.url().includes('assets.huaxu.app')) reqs.failed++; });
    await page.addInitScript(() => {
        const s = document.createElement('style');
        s.textContent = '.ad-float,.corner-feedback{display:none!important}';
        document.addEventListener('DOMContentLoaded', () => document.head.appendChild(s));
    });
    await page.goto(`${BASE}/#/${hash}`, { waitUntil: 'domcontentloaded' });
    if (prepare) await prepare(page);
    await page.waitForTimeout(6000);
    // 图片给了 6s：CDN 在本机常被限速，加载不到的会留 fallback，属环境问题
    const imgs = await page.evaluate(() => {
        const list = [...document.images];
        return {
            total: list.length,
            loaded: list.filter(i => i.complete && i.naturalWidth > 0).length,
            broken: list.filter(i => i.complete && i.naturalWidth === 0).length,
            srcExt: list.reduce((acc, i) => {
                const m = (i.currentSrc || i.src).match(/\.(webp|png|ico|jpe?g)/i);
                const k = m ? m[1].toLowerCase() : 'other';
                acc[k] = (acc[k] || 0) + 1;
                return acc;
            }, {})
        };
    });
    const file = `docs/ui-audit/v2/perf-${name}.png`;
    await page.screenshot({ path: file });
    report[name] = { file, ...imgs, requested: reqs };
    await ctx.close();
}

await shot('home', 'warzone');
await shot('home-mobile', 'warzone', { mobile: true });
await shot('player', 'player', {
    prepare: async page => {
        await page.fill('.search-box input', '27826672');
        await page.keyboard.press('Enter');
        await page.waitForSelector('.player-profile', { timeout: 40000 });
    }
});

console.log(JSON.stringify(report, null, 2));
await browser.close();
