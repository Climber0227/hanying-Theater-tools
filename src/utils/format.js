// 工具函数（迁移自 js/main.js）

export function formatNumber(num) {
    return num ? num.toLocaleString() : '0';
}

export function formatScoreCompact(num) {
    const abs = Math.abs(num);
    if (abs >= 100000000) return (num / 100000000).toFixed(2) + '亿';
    if (abs >= 10000) return (num / 10000).toFixed(1) + '万';
    return String(num);
}

export function formatTime(timeStr) {
    if (!timeStr) return '--';
    return String(timeStr);
}

export function formatDateRange(start, end) {
    if (!start || !end) return '';
    return `${start} ~ ${end}`;
}

// 品质/阶级信息
export function getQualityInfo(rank) {
    const map = {
        1: 'B',
        2: 'A',
        3: 'S',
        4: 'SS',
        5: 'SSS',
        6: 'SSS+'
    };
    return map[rank] || '';
}

// 阵容去重键：角色ID+阶级排序后拼接
export function getTeamKey(chars) {
    return chars.map(c => `${String(c.id || c.characterName)}-${c.rank || 0}`).sort().join('|');
}

// 阵容阶级标签
export function getTeamRankLabel(chars) {
    if (!chars || chars.length === 0) return '';
    const ranks = chars.map(c => c.rank).filter(r => r > 0);
    if (ranks.length === 0) return '';
    const unique = [...new Set(ranks)];
    if (unique.length === 1) return getQualityInfo(unique[0]) || '';
    return unique.map(r => getQualityInfo(r)).join('/');
}

export function fmtTime(ts) {
    const d = new Date(ts);
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fmtDate(ts) {
    const d = new Date(ts);
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// 本周一 0 点时间戳
export function getMondayStart(now = new Date()) {
    const day = now.getDay() || 7;
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - (day - 1)).getTime();
}
