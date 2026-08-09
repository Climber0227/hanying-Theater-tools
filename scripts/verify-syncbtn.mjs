// 验证：绑定场景下卡片同步按钮显示
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
await page.evaluate(() => {
    localStorage.setItem('kurobbs_token', 'test_token');
    localStorage.setItem('kurobbs_phone', '13800000000');
    localStorage.setItem('kurobbs_bound_user', '1');
    const a = document.querySelector('.ad-float'); if (a) a.style.display = 'none';
});
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
await page.click('.nav-btn:has-text("我的")');
await page.waitForTimeout(3000);
const btns = await page.evaluate(() => ({
    header: [...document.querySelectorAll('.week-card-actions .week-trend-btn')].map(b => b.innerText),
    lights: [...document.querySelectorAll('.guide-light')].map(l => l.innerText)
}));
console.log('卡片按钮:', JSON.stringify(btns.header));
console.log('状态灯:', JSON.stringify(btns.lights));
console.log('绑定后同步按钮显示:', btns.header.includes('同步分数') ? 'ok' : 'FAIL');
const sw = await page.evaluate(() => document.documentElement.scrollWidth);
console.log('无溢出:', sw <= 375 ? 'ok' : 'FAIL sw=' + sw);
await browser.close();
