import { useState, useEffect, useCallback, useRef } from 'react';
import { loadWarzone, peekWarzone, friendlyError } from '../api/client.js';
import {
    recordCurveSample,
    uploadCurveSample,
    loadWzSnapshot,
    saveWzSnapshot,
    WZ_SNAPSHOT_VERSION,
    WZ_SNAPSHOT_INTERVAL
} from '../api/storage.js';

// 战区数据加载：难度/周切换、30分钟自动刷新、快照基线、曲线采样
const CACHE_FRESH = 60 * 1000; // 本地缓存 60s 内直接当新数据用，不再打源站

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
    const reqSeqRef = useRef(0); // 请求序号：丢弃过期响应，避免快速切难度时串台
    const retriedKeyRef = useRef(null); // 已自动重试过的「难度/周」，防止无限重试

    const refresh = useCallback(() => setTick(t => t + 1), []);
    const refreshForce = useCallback(() => {
        forceRef.current = true;
        setTick(t => t + 1);
    }, []);

    // 30 分钟自动刷新（仅本周数据参与；页面在后台时不刷新，避免白耗流量和电）
    useEffect(() => {
        const timer = setInterval(() => {
            if (!document.hidden) refresh();
        }, 30 * 60 * 1000);
        return () => clearInterval(timer);
    }, [refresh]);

    useEffect(() => {
        let cancelled = false;
        const reqId = reqSeqRef.current + 1;
        reqSeqRef.current = reqId;
        const requestKey = `${difficulty}/${week}`;
        const forced = forceRef.current;
        forceRef.current = false;

        // 把一份完整响应落到状态里（网络数据与本地缓存共用同一条路径）
        const apply = ({ warzone, rankings: list, activities }) => {
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
                const zoneNames = (warzone.area.zones || []).map(z => z.name);
                const sampled = recordCurveSample(difficulty, curWeek, list, zoneNames);
                if (sampled) uploadCurveSample(difficulty, curWeek, list);
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
        };

        // 本地有 10 分钟内的数据：先上屏（0ms），再决定要不要后台校验
        const cached = forced ? null : peekWarzone(difficulty, week);
        if (cached) {
            apply(cached.data);
            if (cached.age < CACHE_FRESH) {
                setLoading(false);
                setError(null);
                return () => { cancelled = true; };
            }
        }

        (async () => {
            setLoading(!cached);
            setError(null);
            try {
                const payload = await loadWarzone(difficulty, week, forced);
                if (cancelled || reqSeqRef.current !== reqId) return;
                retriedKeyRef.current = null;
                apply(payload);
            } catch (e) {
                if (cancelled || reqSeqRef.current !== reqId) return;
                const message = friendlyError(e);
                if (!message) return; // 主动取消，不算错误
                // 保留上一次的数据，只标记错误，绝不清空榜单
                setError(message);
                if (retriedKeyRef.current !== requestKey) {
                    retriedKeyRef.current = requestKey;
                    // 瞬时抖动自动重试一次（同一难度/周只重试一次）
                    setTimeout(() => { if (!cancelled) setTick(t => t + 1); }, 1500);
                }
            } finally {
                if (!cancelled && reqSeqRef.current === reqId) setLoading(false);
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
