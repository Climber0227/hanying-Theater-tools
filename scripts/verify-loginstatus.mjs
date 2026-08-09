// 验证：登录状态加载态 + 已登录/已绑定弹窗状态视图
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
await page.evaluate(() => { const a = document.querySelector('.ad-float'); if (a) a.style.display = 'none'; });
await page.click('.nav-btn:has-text("我的")');

// 1. 立即检查：auth 初始化中应显示"检查中"（或已就绪——取决于加载速度，检查灯存在）
await page.waitForTimeout(300);
const early = await page.evaluate(() => [...document.querySelectorAll('.guide-light')].map(l => ({ text: l.innerText, checking: l.classList.contains('checking') })));
console.log('早期状态:', JSON.stringify(early));

// 2. 等待 authReady 后
await page.waitForTimeout(2500);
const settled = await page.evaluate(() => [...document.querySelectorAll('.guide-light')].map(l => ({ text: l.innerText, checking: l.classList.contains('checking') })));
console.log('就绪状态:', JSON.stringify(settled));
console.log('检查中态存在:', early.some(l => l.checking) ? 'ok' : 'warn(可能已就绪)', '| 就绪后无检查中:', settled.every(l => !l.checking) ? 'ok' : 'FAIL');

// 3. 未登录时打开弹窗 → 表单
await page.click('.guide-step .guide-action:not(.guide-action-kuro)');
await page.waitForTimeout(500);
const form = await page.evaluate(() => ({
    title: document.querySelector('.team-modal-title')?.innerText,
    hasForm: !!document.querySelector('.login-modal-body input'),
    hasDone: !!document.querySelector('.login-done')
}));
console.log('未登录弹窗:', JSON.stringify(form));
console.log('未登录显示表单:', form.hasForm && !form.hasDone ? 'ok' : 'FAIL');
await page.click('.modal-close');
await page.waitForTimeout(300);

// 4. 模拟已登录：注入 token（网站账号 auth token）
await page.evaluate(() => {
    const KEY = 'huaxu_auth_token';
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) {
            localStorage.setItem(KEY, JSON.stringify({ token: 'test', playerId: '10001', playerName: '测试玩家' }));
        }
    } catch { }
});
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
await page.evaluate(() => { const a = document.querySelector('.ad-float'); if (a) a.style.display = 'none'; });
await page.click('.nav-btn:has-text("我的")');
await page.waitForTimeout(2500);
// 已登录 → 弹窗显示状态视图
await page.click('.guide-step .guide-action:not(.guide-action-kuro)');
await page.waitForTimeout(500);
const doneView = await page.evaluate(() => ({
    hasDone: !!document.querySelector('.login-done'),
    doneText: document.querySelector('.login-done-text')?.innerText || '',
    hasForm: !!document.querySelector('.login-modal-body input')
}));
console.log('已登录弹窗:', JSON.stringify(doneView));
console.log('已登录显示状态视图:', doneView.hasDone && !doneView.hasForm ? 'ok' : 'FAIL');
const sw = await page.evaluate(() => document.documentElement.scrollWidth);
console.log('无溢出:', sw <= 375 ? 'ok' : 'FAIL sw=' + sw);
await browser.close();
