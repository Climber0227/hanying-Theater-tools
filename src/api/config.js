// API 配置（迁移自 js/config.js）

export const API_CONFIG = {
    warzone: 'https://api.huaxu.app/servers/cn/warzone',
    player: 'https://api.huaxu.app/servers/cn/players',
    ppc: 'https://api.huaxu.app/servers/cn/ppc',
    assets: 'https://assets.huaxu.app/cn'
};

export function getImageUrl(path) {
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
