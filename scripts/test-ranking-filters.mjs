// 搜索 / 筛选 / 排序的功能回归（验证 useDeferredValue 改造没有把过滤逻辑改坏）
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4173';
const wz = JSON.parse(fs.readFileSync('docs/perf/fixture-warzone-16.json', 'utf8'));
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch({ channel: 'chrome' });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.route('https://assets.huaxu.app/**', r => r.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }));
await page.route('https://api.huaxu.app/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(wz) }));
await page.route('**/api/visit', r => r.fulfill({ status: 200, body: '{"count":1}' }));

await page.goto(BASE + '/#/warzone', { waitUntil: 'load' });
await page.waitForFunction(() => document.querySelectorAll('.ranking-row').length >= 5 && !document.querySelector('.skeleton-row'), null, { timeout: 30000 });
await page.addStyleTag({ content: '.ad-float,.corner-feedback{display:none!important}' });

const foot = () => page.evaluate(() => (document.querySelector('.panel-foot') || {}).innerText || '');
const firstName = () => page.evaluate(() => document.querySelector('.ranking-row .player-name')?.textContent || '');

const results = [];
const ok = (name, cond, extra = '') => {
    results.push({ name, pass: !!cond });
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
};

const baseName = await firstName();
ok('初始有数据', !!baseName, baseName);
const baseFoot = await foot();

// 搜索：输入名字片段
const search = page.locator('.ranking-search input');
await search.click();
await search.fill(baseName.slice(0, 2));
await sleep(400);
const filteredName = await firstName();
ok('搜索后首行包含关键词', filteredName.includes(baseName.slice(0, 2)), filteredName);

// 搜索：不存在
await search.fill('zzzz不存在zzzz');
await sleep(400);
const emptyShown = await page.evaluate(() => !!document.querySelector('.ranking-empty'));
const namesNow = await page.evaluate(() => document.querySelectorAll('.ranking-row').length);
ok('无结果时显示空态', emptyShown && namesNow === 0, `rows=${namesNow}`);

// 清空搜索
await search.fill('');
await sleep(400);
ok('清空搜索恢复列表', (await firstName()).length > 0);
ok('清空搜索恢复总数', (await foot()) === baseFoot, `${await foot()} vs ${baseFoot}`);

// 筛选：打开筛选弹层，给第一个区选 SSS+
await page.locator('.filter-btn').click();
await page.waitForSelector('.filter-pop', { timeout: 5000 });
const selects = page.locator('.filter-pop .char-slot-select');
const optCount = await selects.first().locator('option').count();
await selects.first().selectOption({ index: optCount - 1 });
await sleep(400);
const chips = await page.locator('.filter-chip').count();
ok('筛选后出现 chips', chips >= 1, `chips=${chips}`);
const filteredFoot = await foot();
ok('筛选后人数变化', filteredFoot !== baseFoot, `${filteredFoot}`);
await page.locator('.filter-btn').click();

// 清除全部
const clearAll = page.locator('.clear-all-btn');
if (await clearAll.count()) {
    await clearAll.click();
    await sleep(400);
    ok('清除全部恢复总数', (await foot()) === baseFoot, `${await foot()} vs ${baseFoot}`);
    ok('清除全部后 chips 消失', (await page.locator('.filter-chip').count()) === 0);
}

// 排序：点区名排序，不应报错且有数据
await page.locator('.col-sort').first().click();
await sleep(400);
ok('排序后仍有数据', (await firstName()).length > 0);
ok('无运行时异常', errors.length === 0, errors.join(' | '));

fs.writeFileSync('docs/perf/filter-regression.json', JSON.stringify({ results, errors }, null, 2));
await browser.close();
const failed = results.filter(r => !r.pass).length;
console.log(failed === 0 ? '\n全部通过' : `\n${failed} 项失败`);
process.exit(failed === 0 ? 0 : 1);
