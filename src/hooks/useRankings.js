import { useState, useMemo, useCallback } from 'react';

// 排行榜筛选/排序/搜索状态与派生数据
export function useRankings(rawRankings, zones) {
    const [searchQuery, setSearchQuery] = useState('');
    const [charFilters, setCharFilters] = useState({}); // { zoneIdx: [v, v, v] } v=''|'3'..'6'
    const [sortKey, setSortKey] = useState(null); // null | 'total' | zoneIdx 字符串
    const [sortAsc, setSortAsc] = useState(false);

    const filtered = useMemo(() => {
        let list = (rawRankings || []).filter(r => r && r.player && r.score > 0).filter(r => {
            if (searchQuery && r.player) {
                const q = searchQuery.toLowerCase();
                const nameMatch = (r.player.name || '').toLowerCase().includes(q);
                const idMatch = String(r.player.id).includes(searchQuery);
                if (!nameMatch && !idMatch) return false;
            }
            const zoneArr = zones || [];
            return Object.entries(charFilters).every(([ziStr, vals]) => {
                const zone = zoneArr[parseInt(ziStr)];
                if (!zone) return true;
                return vals.every((fv, ci) => {
                    if (!fv) return true;
                    const zd = r.zones ? r.zones.find(z => z.id === zone.id) : null;
                    const ch = zd && zd.characters ? zd.characters[ci] : null;
                    return ch && ch.rank === parseInt(fv);
                });
            });
        });

        if (sortKey !== null) {
            list = [...list].sort((a, b) => {
                let va, vb;
                if (sortKey === 'total') {
                    va = a.score || 0;
                    vb = b.score || 0;
                } else {
                    const zone = (zones || [])[parseInt(sortKey)];
                    const za = a.zones ? a.zones.find(z => z.id === zone.id) : null;
                    const zb = b.zones ? b.zones.find(z => z.id === zone.id) : null;
                    va = za ? za.score || 0 : 0;
                    vb = zb ? zb.score || 0 : 0;
                }
                return sortAsc ? va - vb : vb - va;
            });
        }
        return list.slice(0, 100);
    }, [rawRankings, zones, searchQuery, charFilters, sortKey, sortAsc]);

    const setCharFilter = useCallback((zi, ci, val) => {
        setCharFilters(f => {
            const cur = f[zi] || ['', '', ''];
            const next = cur.map((v, i) => (i === ci ? val : v));
            return { ...f, [zi]: next };
        });
    }, []);

    const setZoneQuick = useCallback((zi, val) => {
        setCharFilters(f => ({ ...f, [zi]: [val, val, val] }));
    }, []);

    const toggleSort = useCallback(key => {
        setSortKey(prevKey => (prevKey === key ? prevKey : key));
        setSortAsc(prevAsc => (sortKey === key ? !prevAsc : false));
    }, [sortKey]);

    const resetFilters = useCallback(() => {
        setCharFilters({});
        setSearchQuery('');
        setSortKey(null);
        setSortAsc(false);
    }, []);

    return {
        searchQuery,
        setSearchQuery,
        charFilters,
        setCharFilter,
        setZoneQuick,
        sortKey,
        sortAsc,
        toggleSort,
        resetFilters,
        filtered
    };
}
