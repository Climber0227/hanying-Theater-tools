// localStorage 存储封装（迁移自 js/main.js：快照 / 曲线 / 历史 / 关注）

const CURVE_PREFIX = 'huaxu_wz_curve_';
const SNAP_PREFIX = 'huaxu_wz_snap_';
const HISTORY_KEY = 'huaxu_search_history';
const FOLLOWS_KEY = 'huaxu_follows';

// ========== 趋势曲线采样 ==========
// 返回 true 表示本次确实写入了新采样（用于判断是否需要上传后端）
// zoneNames：三区名数组，采样时随分数一起存（读取时按名匹配，防止三区顺序变化导致错位）
export function recordCurveSample(difficulty, activity, rankings, zoneNames) {
    try {
        const key = `${CURVE_PREFIX}${difficulty}_${activity}`;
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const k = localStorage.key(i);
            if (k && k.startsWith(CURVE_PREFIX) && !k.endsWith(`_${activity}`)) {
                localStorage.removeItem(k);
            }
        }
        let data = null;
        try { data = JSON.parse(localStorage.getItem(key)); } catch { /* 忽略损坏 */ }
        if (!data || !data.samples) data = { samples: [] };

        const sample = { t: Date.now(), p: {}, names: zoneNames || [] };
        (rankings || []).forEach(r => {
            sample.p[String(r.player.id)] = {
                n: r.player.name,
                z: (r.zones || []).map((z, i) => ({ n: (zoneNames || [])[i] || '', s: z.score || 0 })),
                t: r.score || 0
            };
        });

        const last = data.samples[data.samples.length - 1];
        if (last) {
            if (Date.now() - last.t < 60 * 1000) return false;
            if (JSON.stringify(last.p) === JSON.stringify(sample.p)) return false;
        }
        data.samples.push(sample);
        if (data.samples.length > 200) data.samples = data.samples.slice(-200);
        localStorage.setItem(key, JSON.stringify(data));
        return true;
    } catch { /* 忽略 */ }
    return false;
}

export function getPlayerCurve(playerId, difficulty, activity) {
    const key = `${CURVE_PREFIX}${difficulty}_${activity}`;
    let data = null;
    try { data = JSON.parse(localStorage.getItem(key)); } catch { return []; }
    if (!data || !data.samples) return [];
    return data.samples.map(s => {
        const p = s.p[String(playerId)];
        if (!p) return null;
        // 新格式：z 为 {n: 区名, s: 分数} 对象数组；旧格式：纯数字数组（无区名按顺序兜底）
        const raw = p.z || [];
        const isObj = raw.length > 0 && typeof raw[0] === 'object';
        return {
            t: s.t,
            zones: isObj ? raw.map(x => x.s) : raw,
            names: isObj ? raw.map(x => x.n || '') : (s.names || null),
            total: p.t
        };
    }).filter(Boolean);
}

// ========== 趋势曲线上传（后端共享） ==========
// 前端采样后 fire-and-forget 上传到 /api/trends；失败静默（本地兜底仍在）
export function uploadCurveSample(difficulty, activity, rankings) {
    try {
        const url = '/api/trends';
        const body = {
            week: activity,
            difficulty,
            samples: (rankings || []).map(r => ({
                playerId: r.player && r.player.id,
                name: r.player && r.player.name,
                zones: (r.zones || []).map(z => z.score || 0),
                total: r.score || 0
            }))
        };
        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        }).then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.json();
        }).catch(() => { /* 离线/本地环境忽略 */ });
    } catch { /* 忽略 */ }
}

// ========== 30 分钟排名快照 ==========
export const WZ_SNAPSHOT_VERSION = 3;
export const WZ_SNAPSHOT_INTERVAL = 30 * 60 * 1000;

export function loadWzSnapshot(difficulty) {
    try {
        const raw = localStorage.getItem(`${SNAP_PREFIX}${difficulty}`);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

export function saveWzSnapshot(difficulty, snapshot) {
    try {
        localStorage.setItem(`${SNAP_PREFIX}${difficulty}`, JSON.stringify(snapshot));
    } catch { /* 忽略 */ }
}

// ========== 查询历史 / 关注 ==========
export function getSearchHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch { return []; }
}
export function saveSearchHistory(list) {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list)); } catch { /* 隐私模式/配额超限忽略 */ }
}
export function getFollows() {
    try { return JSON.parse(localStorage.getItem(FOLLOWS_KEY)) || []; } catch { return []; }
}
export function saveFollows(list) {
    try { localStorage.setItem(FOLLOWS_KEY, JSON.stringify(list)); } catch { /* 隐私模式/配额超限忽略 */ }
}
