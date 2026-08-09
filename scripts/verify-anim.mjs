// 验证：灵动化入场（页面淡入 + 我的页区块 stagger）
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
await page.evaluate(() => { const a = document.querySelector('.ad-float'); if (a) a.style.display = 'none'; });
await page.click('.nav-btn:has-text("我的")');
await page.waitForTimeout(500);
const info = await page.evaluate(() => ({
    pageFade: !!document.querySelector('.page-fade'),
    animBlocks: [...document.querySelectorAll('.anim-in')].map(e => getComputedStyle(e).animationDelay),
    animNames: [...document.querySelectorAll('.anim-in')].map(e => getComputedStyle(e).animationName),
    overflow: document.documentElement.scrollWidth > window.innerWidth
}));
console.log(JSON.stringify(info, null, 1));
console.log('页面淡入容器:', info.pageFade ? 'ok' : 'FAIL');
console.log('区块stagger延迟:', info.animBlocks.length >= 5 ? 'ok' : 'FAIL', JSON.stringify(info.animBlocks));
console.log('动画生效(fade-up):', info.animNames.every(n => n === 'fade-up') ? 'ok' : 'FAIL');
console.log('无溢出:', !info.overflow ? 'ok' : 'FAIL');
await browser.close();
