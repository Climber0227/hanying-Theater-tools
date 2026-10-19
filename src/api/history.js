// 历届上榜记录（玩家维度，一次请求拿全部周）
// GET /servers/cn/players/{id}/warzone
//   → data.rankings: [{ warzone: { activity, challenge, start, end, area: { zones } },
//                       rank: { rank, player, score, zones: [{ id, score, characters: [...] }] } }]
// 说明：只包含该玩家进入 TOP100 的周（结算后的周），单次最多约 100 周；响应约 500KB（gzip 后 ~20KB）
// 用途：隐藏角色详情时，用历届上阵阵容反推角色阶级/战力

import { API_CONFIG } from './config.js';
import { fetchJson } from './client.js';

const CACHE_VERSION = 1;
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 小时
const cacheKey = playerId => `huaxu_roster_${playerId}`;

function normalizeWeek(item) {
    if (!item || !item.warzone || item.warzone.activity == null) return null;
    const wz = item.warzone;
    const rk = item.rank || {};
    const zoneNames = new Map();
    ((wz.area && wz.area.zones) || []).forEach(z => {
        if (z && z.id != null) zoneNames.set(String(z.id), z.name || '');
    });
    const zones = (rk.zones || [])
        .filter(z => z && z.id != null)
        .map(z => ({
            id: z.id,
            name: zoneNames.get(String(z.id)) || '',
            score: z.score || 0,
            characters: (z.characters || []).filter(c => c && c.id != null)
        }));
    return {
        week: wz.activity,
        difficulty: String(wz.challenge || ''),
        rank: rk.rank || 0,
        score: rk.score || 0,
        zones
    };
}

// 拉取并归一化：返回按周次降序排列的记录数组
export async function loadPlayerHistory(playerId, { signal, force = false } = {}) {
    const url = `${API_CONFIG.player}/${playerId}/warzone`;
    // 响应约 500KB，不进内存缓存（避免多玩家累积占用）；结果由 localStorage 反推缓存兜底
    const result = await fetchJson(url, { signal, force, cache: false });
    if (!result || result.status !== 'success' || !result.data) {
        throw new Error('历届战绩接口返回异常');
    }
    const list = Array.isArray(result.data.rankings) ? result.data.rankings : [];
    const weeks = list.map(normalizeWeek).filter(Boolean);
    weeks.sort((a, b) => b.week - a.week);
    return weeks;
}

// ===== 反推结果缓存（localStorage） =====
export function readRosterCache(playerId) {
    try {
        const raw = localStorage.getItem(cacheKey(playerId));
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (!data || data.v !== CACHE_VERSION || !Array.isArray(data.chars) || !data.summary) return null;
        return data;
    } catch {
        return null;
    }
}

export function writeRosterCache(playerId, data) {
    try {
        localStorage.setItem(cacheKey(playerId), JSON.stringify({ v: CACHE_VERSION, ...data, at: Date.now() }));
    } catch { /* 配额不足时静默 */ }
}

export function clearRosterCache(playerId) {
    try { localStorage.removeItem(cacheKey(playerId)); } catch { /* 忽略 */ }
}

export function isRosterCacheFresh(cache) {
    return !!cache && Date.now() - (cache.at || 0) < CACHE_TTL;
}
