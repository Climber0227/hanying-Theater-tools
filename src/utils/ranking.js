// 排名差值计算（基于 30 分钟快照基线）
import { getTeamKey } from './format.js';

export function getRankDelta(playerId, currentRank, currentScore, prevSnapshot) {
    if (!prevSnapshot || !prevSnapshot.entries) return null;
    const prev = prevSnapshot.entries.find(e => String(e.id) === String(playerId));
    if (!prev) return null;
    const rankDelta = (prev.rank || 0) - (currentRank || 0);
    const scoreDelta = (currentScore || 0) - (prev.score || 0);
    return {
        rankDelta,
        scoreDelta,
        zoneScores: prev.zones || {}
    };
}

// 每区各阵容最高分对比 map[区ID][阵容key] = { score, chars, player }
export function computeTeamMaxScores(rankings, zones) {
    const map = {};
    (zones || []).forEach(z => { map[z.id] = {}; });
    (rankings || []).forEach(r => {
        if (!r || !r.player || !r.zones) return;
        r.zones.forEach(zd => {
            if (!zd || !zd.characters || zd.characters.length === 0) return;
            const key = getTeamKey(zd.characters);
            const score = zd.score || 0;
            if (!map[zd.id]) map[zd.id] = {};
            const cur = map[zd.id][key];
            if (!cur || score > cur.score) {
                map[zd.id][key] = {
                    score,
                    chars: zd.characters,
                    player: {
                        id: r.player.id,
                        name: r.player.name,
                        portrait: r.player.portrait,
                        frame: r.player.frame
                    }
                };
            }
        });
    });
    return map;
}
