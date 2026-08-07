import { API_CONFIG } from './config.js';

// 内存缓存：URL → { data, expire }，TTL 60s（与 CDN max-age=60 对齐）
// 目的：切难度/切周/页面跳转复用数据，减少对源站请求次数
const CACHE_TTL = 60 * 1000;
const cache = new Map();

export async function fetchJson(url, { force = false, signal } = {}) {
    if (!force) {
        const hit = cache.get(url);
        if (hit && Date.now() < hit.expire) return hit.data;
    }
    const response = await fetch(url, { signal });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    cache.set(url, { data, expire: Date.now() + CACHE_TTL });
    return data;
}

// 清空缓存（登录/登出等场景）
export function clearApiCache() {
    cache.clear();
}

// 战区数据：week 为 null 表示本周；force 为 true 时跳过缓存（手动刷新）
export async function loadWarzone(difficulty, week, force = false) {
    const weekPath = week == null ? 'current' : week;
    const url = `${API_CONFIG.warzone}/${weekPath}/${difficulty}`;
    const result = await fetchJson(url, { force });
    if (result.status !== 'success' || !result.data || !result.data.warzone) {
        throw new Error('API 返回数据格式错误');
    }
    return {
        warzone: result.data.warzone,
        rankings: result.data.rankings,
        activities: result.data.activities || null
    };
}

export async function loadPlayer(playerId, signal) {
    const result = await fetchJson(`${API_CONFIG.player}/${playerId}`, { signal });
    if (result.status !== 'success' || !result.data) {
        throw new Error('玩家不存在');
    }
    return result.data;
}

export async function loadPpc(week, level) {
    const weekPath = week == null ? 'current' : week;
    const result = await fetchJson(`${API_CONFIG.ppc}/${weekPath}/${level}?ranking=true`);
    if (result.status !== 'success' || !result.data) {
        throw new Error('API 返回数据格式错误');
    }
    return result.data;
}
