// 验证：本周分数区卡重构后排版（桌面一行 head + subs 独立行 / 手机纵向）
import { chromium } from 'playwright';

const browser = await chromium.launch();
let failures = 0;
const check = (name, cond, extra = '') => {
    console.log((cond ? 'ok   ' : 'FAIL ') + name + (extra ? ' — ' + extra : ''));
    if (!cond) failures++;
};

const SEED = () => {
    localStorage.setItem('my_wz_last_sync', JSON.stringify({
        area: {
            areaInfo: {
                totalPoint: 30000000, totalChallengeTimes: 3,
                stageFightInfoList: [
                    { stageName: '火焰轮回', point: 10000000, totalNum: 3, npcGroup: 12, areaBuffFightInfoList: [{}],
                      subs: [{ name: '猩红冰原', score: 10000000, fightTime: 5 }, { name: '岩流深壑', score: 9800000, fightTime: 6 }] },
                    { stageName: '空域浮台', point: 10000000, totalNum: 3, npcGroup: 12, areaBuffFightInfoList: [{}],
                      subs: [{ name: '原初空栈', score: 10000000, fightTime: 4 }] },
                    { stageName: '熵钟异数', point: 10000000, totalNum: 3, npcGroup: 12, areaBuffFightInfoList: [{}],
                      subs: [{ name: '悼亡鸦吟', score: 10000000, fightTime: 7 }] }
                ]
            },
            groupName: '传奇', groupLevel: '80-120'
        },
        ppc: { prisonerCage: { totalPoint: 9000000, totalChallengeTimes: 3, bossFightInfoList: [] } },
        roleId: 'test', serverId: 'test'
    }));
};

for (const vp of [{ name: 'mobile-375', width: 375, height: 812 }, { name: 'desktop-1440', width: 1440, height: 900 }]) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await page.evaluate(SEED);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await page.evaluate(() => { const a = document.querySelector('.ad-float'); if (a) a.style.display = 'none'; });
    await page.click('.nav-btn:has-text("我的")');
    await page.waitForTimeout(3500);
    const info = await page.evaluate(() => {
        const zone = document.querySelector('.week-zone');
        const get = sel => { const r = zone.querySelector(sel).getBoundingClientRect(); return { y: Math.round(r.top), x: Math.round(r.left), right: Math.round(r.right) }; };
        const name = get('.week-zone-name');
        const score = get('.week-zone-score');
        const foot = get('.week-zone-foot');
        const subs = get('.week-zone-subs');
        const items = [...zone.querySelectorAll('.week-zone-sub-item')].map(e => e.innerText);
        const head = zone.querySelector('.week-zone-head').getBoundingClientRect();
        return {
            nameY: name.y, scoreY: score.y, footY: foot.y, subsY: subs.y,
            subsBelowHead: subs.y > head.bottom - 2,
            items,
            zoneRight: Math.round(zone.getBoundingClientRect().right),
            iw: window.innerWidth
        };
    });
    const mobile = vp.name === 'mobile-375';
    // 区名与分数同行（top 行内）
    const row1 = Math.abs(info.nameY - info.scoreY) <= 3;
    // subs 在 head 下方独立行
    const subsOk = info.subsBelowHead && info.subsY > info.footY;
    // 不溢出
    const noOverflow = info.zoneRight <= info.iw + 1;
    console.log(`${vp.name}: row1=${row1 ? 'ok' : 'FAIL'} subs独立行=${subsOk ? 'ok' : 'FAIL'} 无溢出=${noOverflow ? 'ok' : 'FAIL'}`);
    console.log(JSON.stringify(info));
    if (!row1 || !subsOk || !noOverflow) failures++;
    if (mobile) {
        console.log('子区chips:', JSON.stringify(info.items));
        if (info.items.length !== 5 || !info.items[0].includes('猩红冰原') || !info.items[0].includes('5min')) failures++;
    }
    await page.close();
}
await browser.close();
console.log(failures ? `\n${failures} 项失败` : '\n全部通过');
process.exit(failures ? 1 : 0);
