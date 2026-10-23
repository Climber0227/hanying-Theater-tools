// API 配置（迁移自 js/config.js）

import { localIconPath } from './charPack.generated.js';

export const API_ORIGIN = 'https://api.huaxu.app';

export const API_CONFIG = {
    warzone: `${API_ORIGIN}/servers/cn/warzone`,
    player: `${API_ORIGIN}/servers/cn/players`,
    ppc: `${API_ORIGIN}/servers/cn/ppc`,
    assets: 'https://assets.huaxu.app/cn'
};

// ---------- 上游 API 代理 ----------
// 线上环境走同源 /api/huaxu（Vercel 函数 + CDN 缓存）：
//   · 命中 CDN 时函数不执行，用户也不用等源站偶发 20s 卡顿
//   · 源站抖动时函数返回上一份快照（stale），页面不会空白
// 本地开发（vite dev，端口 localhost）和 Electron（file://）没有该函数，仍直连源站。
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '[::1]']);

function detectProxy() {
    if (typeof window === 'undefined') return false;
    if (globalThis.__HUAXU_FORCE_PROXY__) return true; // 测试用开关
    if (typeof location === 'undefined') return false;
    if (location.protocol === 'file:') return false;
    return !LOCAL_HOSTS.has(location.hostname);
}

export const USE_API_PROXY = detectProxy();

// path 形如 '/servers/cn/warzone/current/16'；query 为原样附加的查询串
export function apiUrl(path, query = '') {
    if (!USE_API_PROXY) return `${API_ORIGIN}${path}${query ? `?${query}` : ''}`;
    const params = new URLSearchParams({ path });
    if (query) params.set('q', query);
    return `/api/huaxu?${params.toString()}`;
}

// 手动刷新：换一个带 nocache 参数的 URL，绕过 CDN 缓存（只影响这一次请求）
export function apiUrlNoCache(path, query = '') {
    if (!USE_API_PROXY) return `${API_ORIGIN}${path}${query ? `?${query}` : ''}`;
    const params = new URLSearchParams({ path, nocache: '1' });
    if (query) params.set('q', query);
    return `/api/huaxu?${params.toString()}`;
}

// 资源站同路径下同时有 .png 和 .webp（体积约为 png 的 1/7），优先用 webp，
// 万一某个资源没有 webp，imageFallback.js 会把它换回 png。
//
// 角色头像 / 辅助机 / 玩家头像是 1024×1024 的原图（单张 40–150KB），但页面上只显示 20–48px。
// sync-char-icons.mjs 预先缩了一份 96px 的 WebP 放在 /img/chars/（单张 2–4KB），命中就用本地的。
export function getImageUrl(path) {
    if (!path) return '';
    const local = localIconPath(path);
    if (local) return local;
    return `${API_CONFIG.assets}/${path}.webp`;
}

export function getImageUrlPng(path) {
    if (!path) return '';
    return `${API_CONFIG.assets}/${path}.png`;
}

// 难度下拉选项
export const DIFFICULTY_OPTIONS = [
    { value: '16', label: '传奇 (80-120)' },
    { value: '15', label: '英雄 (80-120)' },
    { value: '14', label: '领袖 (80-120)' },
    { value: '13', label: '领袖 (55-79)' },
    { value: '12', label: '尖兵 (80-120)' },
    { value: '11', label: '尖兵 (55-79)' },
    { value: '10', label: '尖兵 (1-54)' },
    { value: '9', label: '先锋 (80-120)' },
    { value: '8', label: '先锋 (55-79)' },
    { value: '7', label: '先锋 (1-54)' },
    { value: '6', label: '侦察 (80-120)' },
    { value: '5', label: '侦察 (55-79)' },
    { value: '4', label: '侦察 (1-54)' },
    { value: '3', label: '预备 (80-120)' },
    { value: '2', label: '预备 (55-79)' },
    { value: '1', label: '预备 (1-54)' }
];

export function getDifficultyLabel(value) {
    const opt = DIFFICULTY_OPTIONS.find(o => o.value === String(value));
    return opt ? opt.label : String(value);
}

// 难度短名（label 冒号前）：16 → 传奇
export function getDifficultyShort(value) {
    const opt = DIFFICULTY_OPTIONS.find(o => o.value === String(value));
    return opt ? opt.label.split(' ')[0] : String(value);
}
