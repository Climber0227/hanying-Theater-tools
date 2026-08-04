import { getTeamKey, getTeamRankLabel, getQualityInfo } from './format.js';
import { computeTeamMaxScores } from './ranking.js';

// ========== 分数分布（10 段直方图） ==========
export function computeBrackets(rankings, zones, key) {
    let scores;
    if (key === 'total') {
        scores = (rankings || []).map(r => r && r.score || 0).filter(s => s > 0);
    } else {
        const zoneId = (zones || [])[parseInt(key)]?.id;
        scores = (rankings || [])
            .map(r => r.zones ? (r.zones.find(z => z.id === zoneId) || {}).score : 0)
            .filter(s => s > 0);
    }
    if (scores.length === 0) return [];
    const max = Math.max(...scores);
    const min = Math.min(...scores);
    const step = Math.ceil((max - min) / 10 / 1000000) * 1000000 || 1000000;
    const buckets = [];
    for (let s = min; s <= max; s += step) {
        const count = scores.filter(sc => sc >= s && sc < s + step).length;
        if (count > 0) buckets.push({ from: s, to: s + step, count });
    }
    const maxCount = Math.max(...buckets.map(b => b.count));
    return { buckets, total: scores.length, maxCount };
}

// ========== 最强阵容（前3） ==========
export function computeStrongTeams(rankings, zoneId) {
    const entries = (rankings || [])
        .map(r => ({ r, zd: r.zones ? r.zones.find(z => z.id === zoneId) : null }))
        .filter(x => x.r && x.r.player && x.zd && x.zd.characters && x.zd.characters.length > 0);
    entries.sort((a, b) => (b.zd.score || 0) - (a.zd.score || 0));
    const seen = new Set();
    const topTeams = [];
    for (const { r, zd } of entries) {
        const key = getTeamKey(zd.characters);
        if (seen.has(key)) continue;
        seen.add(key);
        topTeams.push({ chars: zd.characters, score: zd.score, playerName: r.player.name, playerId: r.player.id });
        if (topTeams.length >= 3) break;
    }
    return topTeams;
}

// ========== 最常用阵容（前5 + 占比） ==========
export function computeCommonTeams(rankings, zoneId) {
    const counts = {};
    let total = 0;
    (rankings || []).forEach(r => {
        if (!r || !r.zones) return;
        const zd = r.zones.find(z => z.id === zoneId);
        if (!zd || !zd.characters || zd.characters.length === 0) return;
        const key = getTeamKey(zd.characters);
        if (!counts[key]) counts[key] = { chars: zd.characters, count: 0 };
        counts[key].count++;
        total++;
    });
    const sorted = Object.values(counts).sort((a, b) => b.count - a.count);
    if (sorted.length === 0 || total === 0) return [];
    const maxCount = sorted[0].count;
    return sorted.slice(0, 5).map(t => ({
        chars: t.chars,
        count: t.count,
        pct: (t.count / total) * 100,
        barWidth: Math.max((t.count / maxCount) * 100, 5)
    }));
}

// ========== 阵容排行（分组） ==========
export function computeRankingGroups(rankings, zoneId, query) {
    const groups = {};
    (rankings || []).forEach(r => {
        if (!r || !r.player || !r.zones) return;
        const zd = r.zones.find(z => z.id === zoneId);
        if (!zd || !zd.characters || zd.characters.length === 0) return;
        const key = getTeamKey(zd.characters);
        if (!groups[key]) groups[key] = { chars: zd.characters, players: [] };
        groups[key].players.push({
            name: r.player.name,
            id: r.player.id,
            portrait: r.player.portrait,
            score: zd.score || 0,
            chars: zd.characters
        });
    });
    let teams = Object.values(groups).filter(t => t.players.length > 0);
    if (query) {
        teams = teams.filter(t => t.chars.some(c => (c.characterName || '').toLowerCase().includes(query)));
    }
    teams.forEach(t => t.players.sort((a, b) => b.score - a.score));
    teams.sort((a, b) => b.players.length - a.players.length || b.players[0].score - a.players[0].score);
    return teams;
}

// ========== 单区分数分析 ==========
export function computeZoneAnalysisData(ranking, zoneIndex, rankings, zones) {
    const zone = (zones || [])[zoneIndex];
    if (!zone) return null;
    const teamMax = computeTeamMaxScores(rankings, zones);
    const zoneData = ranking.zones ? ranking.zones.find(z => z.id === zone.id) : null;
    const zscore = zoneData ? (zoneData.score || 0) : 0;
    let maxInfo = null;
    if (zoneData && zoneData.characters && zoneData.characters.length > 0) {
        const teamKey = getTeamKey(zoneData.characters);
        const max = teamMax[zone.id] && teamMax[zone.id][teamKey];
        if (max && max.score > 0) {
            maxInfo = {
                score: max.score,
                diff: max.score - zscore,
                isTop: max.score - zscore <= 0,
                player: max.player,
                chars: max.chars || []
            };
        }
    }
    return { zone, zoneData, zscore, maxInfo };
}

export { getTeamRankLabel, getQualityInfo };
