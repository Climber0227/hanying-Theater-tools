import { useState, useMemo, useCallback, useDeferredValue } from 'react';

// 排行榜筛选/排序/搜索状态与派生数据
export function useRankings(rawRankings, zones) {
    const [searchQuery, setSearchQuery] = useState('');
    const [charFilters, setCharFilters] = useState({}); // { zoneIdx: [v, v, v] } v=''|'3'..'6'
    const [sortKey, setSortKey] = useState(null); // null | 'total' | zoneIdx 字符串
    const [sortAsc, setSortAsc] = useState(false);

    // 打字优先：搜索词 / 阶级筛选走低优先级的过渡渲染。
    // 原来每敲一个字都要同步重排整张榜单（中端手机上一次按键 50ms+），
    // 现在输入框立即响应，榜单稍后跟上。
    const deferredQuery = useDeferredValue(searchQuery);
    const deferredFilters = useDeferredValue(charFilters);
    const isFiltering = deferredQuery !== searchQuery || deferredFilters !== charFilters;

    // 预建搜索索引：小写名字 / ID 字符串只算一次（原来每敲一个字、每一行都重算一遍）
    const searchIndex = useMemo(() => {
        const map = new Map();
        for (const r of rawRankings || []) {
            if (r && r.player) {
                map.set(r, { name: String(r.player.name || '').toLowerCase(), id: String(r.player.id) });
            }
        }
        return map;
    }, [rawRankings]);

    const filtered = useMemo(() => {
        const q = deferredQuery.trim().toLowerCase();
        const zoneArr = zones || [];
        const activeFilters = Object.entries(deferredFilters).filter(([, vals]) => vals.some(Boolean));

        const list = (rawRankings || [])
            .filter(r => r && r.player && r.score > 0)
            .filter(r => {
                if (q) {
                    const idx = searchIndex.get(r);
                    const nameMatch = idx ? idx.name.includes(q) : false;
                    const idMatch = idx ? idx.id.includes(q) : false;
                    if (!nameMatch && !idMatch) return false;
                }
                if (!activeFilters.length) return true;
                return activeFilters.every(([ziStr, vals]) => {
                    const zone = zoneArr[parseInt(ziStr, 10)];
                    if (!zone) return true;
                    const zd = r.zones ? r.zones.find(z => z.id === zone.id) : null;
                    return vals.every((fv, ci) => {
                        if (!fv) return true;
                        const ch = zd && zd.characters ? zd.characters[ci] : null;
                        return ch && ch.rank === parseInt(fv, 10);
                    });
                });
            });

        if (sortKey === null) return list.slice(0, 100);

        const sorted = [...list].sort((a, b) => {
            let va, vb;
            if (sortKey === 'total') {
                va = a.score || 0;
                vb = b.score || 0;
            } else {
                const zone = zoneArr[parseInt(sortKey, 10)];
                const za = a.zones ? a.zones.find(z => z.id === zone.id) : null;
                const zb = b.zones ? b.zones.find(z => z.id === zone.id) : null;
                va = za ? za.score || 0 : 0;
                vb = zb ? zb.score || 0 : 0;
            }
            return sortAsc ? va - vb : vb - va;
        });
        return sorted.slice(0, 100);
    }, [rawRankings, zones, deferredQuery, deferredFilters, sortKey, sortAsc, searchIndex]);

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
        filtered,
        isFiltering
    };
}
