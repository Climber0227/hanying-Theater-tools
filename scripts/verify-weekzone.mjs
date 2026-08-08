// 验证：week-zone top/foot 两行布局（mobile + desktop）
import { chromium } from 'playwright';

const browser = await chromium.launch();
let failures = 0;
const SAMPLE = `
<div class="week-zone-head">
    <div class="week-zone-top">
        <span class="week-zone-name">火焰轮回</span>
        <span class="week-zone-mech">困兽犹斗</span>
        <span class="week-zone-score">12,345,678</span>
    </div>
    <div class="week-zone-foot">
        <div class="week-zone-tags">
            <span class="week-zone-wave">挑战 3 次</span>
            <span class="week-zone-wave">波次 12</span>
        </div>
        <button class="week-team-btn">阵容</button>
        <button class="week-team-btn week-compare-btn">对比榜单</button>
    </div>
</div>`;

for (const vp of [{ name: 'mobile-375', width: 375, height: 812 }, { name: 'desktop-1440', width: 1440, height: 900 }]) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.evaluate(html => {
        const zone = document.createElement('div');
        zone.className = 'week-zone';
        zone.innerHTML = html;
        document.querySelector('.container').appendChild(zone);
    }, SAMPLE);
    await page.waitForTimeout(300);
    const info = await page.evaluate(() => {
        const head = document.querySelector('.week-zone-head');
        const get = sel => { const r = head.querySelector(sel).getBoundingClientRect(); return { y: Math.round(r.top), x: Math.round(r.left), right: Math.round(r.right) }; };
        const name = get('.week-zone-name');
        const mech = get('.week-zone-mech');
        const score = get('.week-zone-score');
        const tags = get('.week-zone-tags');
        const team = get('.week-team-btn:not(.week-compare-btn)');
        const cmp = get('.week-compare-btn');
        return { nameY: name.y, mechY: mech.y, scoreY: score.y, scoreX: score.x, tagsY: tags.y, teamY: team.y, cmpY: cmp.y, cmpRight: cmp.right, headRight: Math.round(head.getBoundingClientRect().right), iw: window.innerWidth };
    });
    const same = (a, b) => Math.abs(a - b) <= 2;
    const mobile = vp.name === 'mobile-375';
    const row1 = same(info.nameY, info.mechY) && same(info.nameY, info.scoreY);
    // row2：foot 单行（垂直居中导致 y 差 = 按钮高-标签高 / 2）
    const row2 = mobile
        ? (info.tagsY > info.scoreY + 8 && Math.abs(info.tagsY - info.teamY) <= 8 && Math.abs(info.tagsY - info.cmpY) <= 8)
        : same(info.nameY, info.tagsY);
    const noOverflow = info.cmpRight <= info.headRight + 1;
    console.log(`${vp.name}: row1=${row1 ? 'ok' : 'FAIL'} row2=${row2 ? 'ok' : 'FAIL'} 无溢出=${noOverflow ? 'ok' : 'FAIL'}`);
    console.log(JSON.stringify(info));
    if (!row1 || !row2 || !noOverflow) failures++;
    await page.close();
}
await browser.close();
console.log(failures ? `\n${failures} 项失败` : '\n全部通过');
process.exit(failures ? 1 : 0);
