import { useState, useEffect, useCallback, useRef } from 'react';
import { loadWarzone } from '../api/client.js';
import {
    recordCurveSample,
    loadWzSnapshot,
    saveWzSnapshot,
    WZ_SNAPSHOT_VERSION,
    WZ_SNAPSHOT_INTERVAL
} from '../api/storage.js';

// 战区数据加载：难度/周切换、30分钟自动刷新、快照基线、曲线采样
export function useWarzone() {
    const [difficulty, setDifficulty] = useState('16');
    const [week, setWeek] = useState(null); // null = 本周
    const [tick, setTick] = useState(0);
    const [zones, setZones] = useState([]);
    const [rankings, setRankings] = useState([]);
    const [meta, setMeta] = useState({ dateRange: '', members: 0, updatedAt: '' });
    const [weekOptions, setWeekOptions] = useState({ min: null, max: null });
    const [prevSnapshot, setPrevSnapshot] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const currentWeekRef = useRef(null);
    const forceRef = useRef(false);

    const refresh = useCallback(() => setTick(t => t + 1), []);
    const refreshForce = useCallback(() => {
        forceRef.current = true;
        setTick(t => t + 1);
    }, []);

    // 30 分钟自动刷新（仅本周数据参与）
    useEffect(() => {
        const timer = setInterval(refresh, 30 * 60 * 1000);
        return () => clearInterval(timer);
    }, [refresh]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setError(null);
            try {
                const { warzone, rankings: list, activities } = await loadWarzone(difficulty, week, forceRef.current);
                forceRef.current = false;
                if (cancelled) return;
                if (activities) setWeekOptions({ min: activities.min, max: activities.max });
                const curWeek = week === null ? warzone.activity : week;
                currentWeekRef.current = curWeek;
                setZones(warzone.area.zones || []);
                setRankings(list || []);
                setMeta({
                    dateRange: warzone.start && warzone.end ? `${warzone.start} ~ ${warzone.end}` : '',
                    members: warzone.members || 0,
                    updatedAt: warzone.updatedAt || ''
                });

                if (week === null && list) {
                    recordCurveSample(difficulty, curWeek, list);
                    // 排名变化快照（30 分钟基线）
                    const prev = loadWzSnapshot(difficulty);
                    if (prev && prev.version === WZ_SNAPSHOT_VERSION && prev.activity === curWeek) {
                        setPrevSnapshot(prev);
                    } else {
                        setPrevSnapshot(null);
                    }
                    const age = prev ? Date.now() - (prev.timestamp || 0) : Infinity;
                    if (!prev || prev.version !== WZ_SNAPSHOT_VERSION || age >= WZ_SNAPSHOT_INTERVAL) {
                        saveWzSnapshot(difficulty, {
                            version: WZ_SNAPSHOT_VERSION,
                            challenge: difficulty,
                            activity: curWeek,
                            timestamp: Date.now(),
                            entries: list
                                .filter(r => r && r.player && r.score > 0)
                                .map(r => {
                                    const zoneScores = {};
                                    (r.zones || []).forEach(z => {
                                        if (z && z.score > 0) zoneScores[z.id] = z.score;
                                    });
                                    return { id: r.player.id, rank: r.rank, score: r.score, zones: zoneScores };
                                })
                        });
                    }
                } else {
                    setPrevSnapshot(null);
                }
            } catch (e) {
                if (!cancelled) setError(e.message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [difficulty, week, tick]);

    return {
        difficulty,
        setDifficulty,
        week,
        setWeek,
        zones,
        rankings,
        meta,
        weekOptions,
        prevSnapshot,
        loading,
        error,
        refresh,
        refreshForce,
        currentWeek: currentWeekRef.current
    };
}
