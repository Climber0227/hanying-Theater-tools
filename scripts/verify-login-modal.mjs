// 验证：引导状态灯 + 登录弹窗
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
await page.evaluate(() => { const a = document.querySelector('.ad-float'); if (a) a.style.display = 'none'; });
await page.click('.nav-btn:has-text("我的")');
await page.waitForTimeout(2500);

// 1. 引导块状态灯
const lights = await page.evaluate(() => [...document.querySelectorAll('.guide-light')].map(l => ({ text: l.innerText, on: l.classList.contains('on') })));
console.log('状态灯:', JSON.stringify(lights, null, 1));
console.log('两个灯(网站/库街区):', lights.length === 2 ? 'ok' : 'FAIL');
console.log('灯有状态类:', lights.every(l => l.on === false || l.on === true) ? 'ok' : 'FAIL');

// 2. 网站登录按钮 → 弹窗
await page.click('.guide-action:not(.guide-action-kuro)');
await page.waitForTimeout(600);
const webModal = await page.evaluate(() => ({
    tabs: [...document.querySelectorAll('.login-modal-tab')].map(t => t.innerText),
    hasInputs: document.querySelectorAll('.login-modal-body input').length,
    title: document.querySelector('.team-modal-title')?.innerText
}));
console.log('网站弹窗:', JSON.stringify(webModal));
console.log('弹窗打开+双tab:', webModal.tabs.length === 2 && webModal.title.includes('网站账号') ? 'ok' : 'FAIL');
await page.click('.modal-close');
await page.waitForTimeout(400);

// 3. 库街区按钮 → 弹窗 kuro tab
await page.click('.guide-action-kuro');
await page.waitForTimeout(600);
const kuroModal = await page.evaluate(() => ({
    title: document.querySelector('.team-modal-title')?.innerText,
    hasSend: document.querySelectorAll('.login-modal-send').length,
    hint: document.querySelector('.kuro-bound-hint')?.innerText?.slice(0, 20)
}));
console.log('库街区弹窗:', JSON.stringify(kuroModal));
console.log('库街区tab激活:', kuroModal.title.includes('库街区') && kuroModal.hasSend === 1 ? 'ok' : 'FAIL');

// 4. 无溢出
const sw = await page.evaluate(() => document.documentElement.scrollWidth);
console.log('无溢出:', sw <= 375 ? 'ok' : 'FAIL sw=' + sw);
await browser.close();
