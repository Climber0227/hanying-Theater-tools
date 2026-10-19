// 历届阵容反推：把多周上榜记录里的上阵角色按「角色帧」聚合
// 输出每个角色观测到的最高阶级、最高战力、出场周数与最近登场周
// 注意：只统计玩家进入 TOP100 的周，且只包含真正上阵过的角色帧（舱位角色无法反推）

const byDesc = (a, b) => b - a;

function finalize(entry) {
    return {
        id: entry.id,
        name: entry.name,
        frame: entry.frame,
        icon: entry.icon,
        maxRank: entry.maxRank,
        maxBp: entry.maxBp,
        count: entry.weeks.length,
        firstWeek: entry.firstWeek,
        lastWeek: entry.lastWeek,
        weeks: entry.weeks.slice().sort(byDesc),
        zones: [...entry.zones.entries()].map(([id, name]) => ({ id: Number(id), name })),
        cubName: entry.cubName
    };
}

// weeks: loadPlayerHistory 的返回值
export function aggregateRoster(weeks) {
    const map = new Map();
    const weekSet = new Set();
    let slots = 0;
    let minWeek = Infinity;
    let maxWeek = -Infinity;

    for (const w of weeks || []) {
        if (!w || w.week == null) continue;
        weekSet.add(w.week);
        minWeek = Math.min(minWeek, w.week);
        maxWeek = Math.max(maxWeek, w.week);
        for (const z of w.zones || []) {
            for (const c of z.characters || []) {
                if (!c || c.id == null) continue;
                slots++;
                const key = String(c.id);
                let e = map.get(key);
                if (!e) {
                    e = {
                        id: c.id,
                        name: c.characterName || '',
                        frame: c.frameName || '',
                        icon: c.icon || '',
                        maxRank: 0,
                        maxBp: 0,
                        weeks: [],
                        zones: new Map(),
                        firstWeek: w.week,
                        lastWeek: w.week,
                        cubName: ''
                    };
                    map.set(key, e);
                }
                e.maxRank = Math.max(e.maxRank, Number(c.rank) || 0);
                const bp = Number(c.bp) || 0;
                if (bp > e.maxBp) e.maxBp = bp;
                if (!e.icon && c.icon) e.icon = c.icon;
                if (!e.name && c.characterName) e.name = c.characterName;
                if (!e.frame && c.frameName) e.frame = c.frameName;
                if (!e.weeks.includes(w.week)) e.weeks.push(w.week);
                if (z.id != null && z.name) e.zones.set(String(z.id), z.name);
                if (c.cubName) e.cubName = c.cubName;
                if (w.week < e.firstWeek) e.firstWeek = w.week;
                if (w.week > e.lastWeek) e.lastWeek = w.week;
            }
        }
    }

    const chars = [...map.values()].map(finalize);
    const rankDist = {};
    chars.forEach(c => { rankDist[c.maxRank] = (rankDist[c.maxRank] || 0) + 1; });

    const summary = {
        weeks: weekSet.size,
        minWeek: Number.isFinite(minWeek) ? minWeek : null,
        maxWeek: Number.isFinite(maxWeek) ? maxWeek : null,
        unique: chars.length,
        slots,
        maxBp: chars.reduce((m, c) => Math.max(m, c.maxBp), 0),
        maxRank: chars.reduce((m, c) => Math.max(m, c.maxRank), 0),
        rankDist
    };

    return { chars: sortRoster(chars, 'rank'), summary };
}

export function sortRoster(chars, mode = 'rank') {
    const arr = chars.slice();
    if (mode === 'count') {
        arr.sort((a, b) => b.count - a.count || b.maxRank - a.maxRank || b.maxBp - a.maxBp);
    } else if (mode === 'bp') {
        arr.sort((a, b) => b.maxBp - a.maxBp || b.maxRank - a.maxRank || b.count - a.count);
    } else if (mode === 'recent') {
        arr.sort((a, b) => b.lastWeek - a.lastWeek || b.count - a.count || b.maxRank - a.maxRank);
    } else {
        arr.sort((a, b) => b.maxRank - a.maxRank || b.count - a.count || b.maxBp - a.maxBp);
    }
    return arr;
}

// 按「是否公开」拆分反推结果
export function splitByVisibility(chars, characters) {
    const visible = new Set(
        (characters || []).filter(c => c && c.visible).map(c => String(c.id))
    );
    const hidden = [];
    const open = [];
    (chars || []).forEach(c => (visible.has(String(c.id)) ? open : hidden).push(c));
    return { hidden, open, visible };
}

// 反推缓存 → 角色卡展示用的 Map
export function rosterLookup(chars) {
    const map = new Map();
    (chars || []).forEach(c => map.set(String(c.id), c));
    return map;
}
