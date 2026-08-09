// 验证：三步引导（网站/库街区/同步分数）+ 外部同步按钮
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
await page.evaluate(() => { const a = document.querySelector('.ad-float'); if (a) a.style.display = 'none'; });
await page.click('.nav-btn:has-text("我的")');
await page.waitForTimeout(2500);

// 1. 三步标题
const steps = await page.evaluate(() => [...document.querySelectorAll('.guide-step-title')].map(t => t.innerText));
console.log('引导三步:', JSON.stringify(steps));
console.log('三步划分正确:', JSON.stringify(steps) === JSON.stringify(['登录网站账号', '登录库街区', '同步分数']) ? 'ok' : 'FAIL');

// 2. 第 1 步只有一个网站灯
const light1 = await page.evaluate(() => document.querySelector('.guide-step .guide-light')?.innerText);
console.log('第1步网站灯:', light1 === '网站 未登录' ? 'ok' : 'FAIL', JSON.stringify(light1));

// 3. 第 3 步同步按钮
const syncBtn = await page.evaluate(() => [...document.querySelectorAll('.guide-step .guide-action')].map(b => b.innerText));
console.log('三步按钮:', JSON.stringify(syncBtn));
console.log('第3步同步按钮:', syncBtn[2] === '同步分数' ? 'ok' : 'FAIL');

// 4. 本周分数卡 header 同步按钮（需绑定才显示——未绑定场景不显示，检查容器存在）
const headerBtns = await page.evaluate(() => [...document.querySelectorAll('.week-card-actions .week-trend-btn')].map(b => b.innerText));
console.log('卡片header按钮(未绑定):', JSON.stringify(headerBtns));

// 5. 点击网站登录按钮 → 弹窗
await page.click('.guide-step .guide-action:not(.guide-action-kuro)');
await page.waitForTimeout(500);
const modalTitle = await page.evaluate(() => document.querySelector('.team-modal-title')?.innerText);
console.log('弹窗:', JSON.stringify(modalTitle));
await page.click('.modal-close');
await page.waitForTimeout(300);

// 6. 无溢出
const sw = await page.evaluate(() => document.documentElement.scrollWidth);
console.log('无溢出:', sw <= 375 ? 'ok' : 'FAIL sw=' + sw);
await browser.close();
