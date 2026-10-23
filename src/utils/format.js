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

// 后端给的是 ISO 字符串（可能带 6 位小数秒，如 2026-10-23T16:05:00.001091Z），
// 旧实现直接 String() 输出，页面上就是原文。这里统一解析成本地时间显示。
function parseIso(input) {
    if (!input) return null;
    if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;
    const s = String(input).trim();
    // 小数秒超过 3 位时部分浏览器 parse 失败，先截断到毫秒
    const d = new Date(s.replace(/(\.\d{3})\d+/, '$1'));
    return Number.isNaN(d.getTime()) ? null : d;
}

const pad2 = n => String(n).padStart(2, '0');

// '2026-10-23T16:05:00.001091Z' → '10-23 16:05'
export function formatTime(timeStr) {
    const d = parseIso(timeStr);
    if (!d) return timeStr ? String(timeStr) : '--';
    return `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// 起止时间 → '10.18 — 10.25'（跨年时带上年份）
export function formatDateRange(start, end) {
    const a = parseIso(start);
    const b = parseIso(end);
    if (!a || !b) return start && end ? `${start} ~ ${end}` : '';
    const md = d => `${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}`;
    const sameYear = a.getFullYear() === b.getFullYear();
    return sameYear ? `${md(a)} — ${md(b)}` : `${a.getFullYear()}.${md(a)} — ${b.getFullYear()}.${md(b)}`;
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

// 战区属性提取：从 buffs/weathers 描述中找 "XX属性" 关键词
export function extractZoneElement(zone) {
    if (!zone) return '';
    const text = [
        zone.buffDescription || '',
        ...(zone.buffs || []).map(b => b.description || ''),
        ...(zone.weathers || []).map(w => w.description || '')
    ].join(' ');
    const m = text.match(/(物理|火|雷|冰|暗|光)属性/);
    return m ? m[1] : '';
}
