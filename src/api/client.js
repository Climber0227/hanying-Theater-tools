import { API_CONFIG } from './config.js';

export async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    return response.json();
}

// 战区数据：week 为 null 表示本周
export async function loadWarzone(difficulty, week) {
    const weekPath = week == null ? 'current' : week;
    const url = `${API_CONFIG.warzone}/${weekPath}/${difficulty}`;
    const result = await fetchJson(url);
    if (result.status !== 'success' || !result.data || !result.data.warzone) {
        throw new Error('API 返回数据格式错误');
    }
    return {
        warzone: result.data.warzone,
        rankings: result.data.rankings,
        activities: result.data.activities || null
    };
}

export async function loadPlayer(playerId) {
    const result = await fetchJson(`${API_CONFIG.player}/${playerId}`);
    if (result.status !== 'success' || !result.data) {
        throw new Error('玩家不存在');
    }
    return result.data;
}

export async function loadPpc(week) {
    const weekPath = week == null ? 'current' : week;
    const result = await fetchJson(`${API_CONFIG.ppc}/${weekPath}`);
    if (result.status !== 'success' || !result.data) {
        throw new Error('API 返回数据格式错误');
    }
    return result.data;
}
