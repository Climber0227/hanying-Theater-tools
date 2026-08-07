import React, { useEffect, useMemo, useRef, useState } from 'react';
import Modal from './Modal.jsx';
import { fetchJson } from '../../api/client.js';
import { API_CONFIG, DIFFICULTY_OPTIONS, getDifficultyShort, getImageUrl } from '../../api/config.js';
import { formatNumber, extractZoneElement, getQualityInfo } from '../../utils/format.js';

const MAX_WEEKS = 100;
const BATCH_DELAY = 150; // 周间隔（限速）

// 单条历史战绩行：周/段位/排名/总分 + 三区（属性、分数、角色）
function HistoryRow({ row }) {
    return (
        <div className="history-row">
            <div className="history-row-head">
                <span className="history-week">第{row.week}周</span>
                <span className="element-tag">{getDifficultyShort(row.difficulty)}</span>
                <span className={`history-rank${row.rank <= 3 ? ' history-rank-top' : ''}`}>#{row.rank}</span>
                <span className="history-score">{formatNumber(row.score)}</span>
            </div>
            <div className="history-zones">
                {row.zoneMeta.map(meta => {
                    const z = row.zones.find(z => z && z.id === meta.id);
                    const chars = (z && z.characters) || [];
                    return (
                        <div className="history-zone" key={meta.id}>
                            <div className="history-zone-head">
                                <span className="history-zone-name">{meta.name}</span>
                                {extractZoneElement(meta) && (
                                    <span className="element-tag">{extractZoneElement(meta)}</span>
                                )}
                            </div>
                            <div className="history-zone-score">{formatNumber(z ? z.score : 0)}</div>
                            <div className="history-zone-chars">
                                {chars.map(c => (
                                    c.icon ? (
                                        <img
                                            key={c.id}
                                            className="char-icon-sm"
                                            src={getImageUrl(c.icon)}
                                            alt=""
                                            title={`${c.characterName} ${getQualityInfo(c.rank)}`}
                                            onError={e => { e.currentTarget.style.display = 'none'; }}
                                        />
                                    ) : null
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// 历史战绩：自动识别段位（段位范围 + 每周命中即停），周范围下拉选择（最多 100 周）
export default function HistoryModal({ playerId, playerName, difficulty, weekOptions, onClose }) {
    const [rows, setRows] = useState([]);
    const [progress, setProgress] = useState('');
    const [searching, setSearching] = useState(false);
    const [topDiff, setTopDiff] = useState(String(difficulty));
    const [bottomDiff, setBottomDiff] = useState(String(Math.max(1, Number(difficulty) - 2)));
    const [fromWeek, setFromWeek] = useState(null);
    const [toWeek, setToWeek] = useState(null);
    const [rangeError, setRangeError] = useState('');
    const cancelledRef = useRef(false);

    const minWeek = weekOptions.min;
    const maxWeek = weekOptions.max;

    // 段位范围（从高到低）
    const diffs = useMemo(() => {
        const lo = Math.max(1, Math.min(Number(topDiff), Number(bottomDiff)));
        const hi = Math.max(Number(topDiff), Number(bottomDiff));
        const arr = [];
        for (let d = hi; d >= lo; d--) arr.push(String(d));
        return arr;
    }, [topDiff, bottomDiff]);

    // 周下拉选项（降序，最新在前）
    const weekOptionsList = useMemo(() => {
        if (minWeek == null || maxWeek == null) return [];
        const arr = [];
        for (let w = maxWeek; w >= minWeek; w--) arr.push(w);
        return arr;
    }, [minWeek, maxWeek]);

    // 初始化默认范围：最近 100 周
    useEffect(() => {
        if (maxWeek != null && fromWeek == null) {
            setToWeek(maxWeek);
            setFromWeek(Math.max(minWeek, maxWeek - (MAX_WEEKS - 1)));
        }
    }, [minWeek, maxWeek, fromWeek]);

    // 关闭时取消查询
    useEffect(() => () => { cancelledRef.current = true; }, []);

    const search = async () => {
        if (minWeek == null || maxWeek == null) {
            setRangeError('请先加载战区数据');
            return;
        }
        const f = fromWeek;
        const t = toWeek;
        if (f == null || t == null) {
            setRangeError('请选择查询周范围');
            return;
        }
        if (t - f + 1 > MAX_WEEKS) {
            setRangeError(`查询范围最多 ${MAX_WEEKS} 周（当前 ${t - f + 1} 周）`);
            return;
        }
        if (t < f) {
            setRangeError('起始周不能晚于结束周');
            return;
        }
        setRangeError('');
        cancelledRef.current = false;
        setRows([]);
        setSearching(true);

        const results = [];
        let checked = 0;

        // 段位链式搜索：每周段位只可能 晋级(+1)/保级(0)/掉级(-1)
        // 从上周命中段位 d 的邻域 [d, d+1, d-1] 依次查，命中即停
        const lo = Math.max(1, Math.min(Number(topDiff), Number(bottomDiff)));
        const hi = Math.max(Number(topDiff), Number(bottomDiff));
        const neighbors = d => [d, d + 1, d - 1].filter(x => x >= lo && x <= hi).map(String);
        const memKey = `history_last_diff_${playerId}`;
        let hitD = null;

        // 起始候选：记忆的最近段位及其邻域优先；无记忆则从范围最高段位降序
        let initCandidates = [];
        try {
            const m = Number(localStorage.getItem(memKey));
            if (m && m >= lo && m <= hi) {
                initCandidates = [m, m + 1, m - 1].filter(x => x >= lo && x <= hi).map(String);
            }
        } catch { /* 忽略 */ }
        if (initCandidates.length === 0) initCandidates = diffs;
        let firstWeek = true;

        for (let w = t; w >= f; w--) {
            if (cancelledRef.current) break;
            const candidates = firstWeek ? initCandidates : neighbors(hitD);
            firstWeek = false;

            let hit = null;
            for (const d of candidates) {
                if (cancelledRef.current) break;
                const result = await fetchJson(`${API_CONFIG.warzone}/${w}/${d}`).catch(() => null);
                if (result && result.status === 'success' && result.data && result.data.rankings) {
                    const found = result.data.rankings.find(r => r && r.player && String(r.player.id) === String(playerId));
                    if (found) {
                        hit = {
                            difficulty: d,
                            rank: found.rank,
                            score: found.score || 0,
                            zones: found.zones || [],
                            zoneMeta: (result.data.warzone && result.data.warzone.area && result.data.warzone.area.zones) || []
                        };
                        break;
                    }
                }
                await new Promise(r => setTimeout(r, 60));
            }

            if (hit) {
                hitD = Number(hit.difficulty);
                try { localStorage.setItem(memKey, String(hitD)); } catch { /* 忽略 */ }
                results.push({ week: w, ...hit });
            }
            checked++;
            setProgress(`查询中... 已查 ${checked} 周`);
            await new Promise(r => setTimeout(r, BATCH_DELAY));
        }

        if (cancelledRef.current) return;
        setSearching(false);
        results.sort((a, b) => a.week - b.week);
        setRows(results);
        setProgress(`共找到 ${results.length} 周上榜记录`);
    };

    return (
        <Modal
            title={`${playerName} 历史战绩`}
            sub={`自动识别段位 · 仅统计进入 TOP100 的周`}
            onClose={onClose}
            wide
        >
            <div className="history-config">
                <span className="history-config-label">段位</span>
                <select
                    value={topDiff}
                    onChange={e => setTopDiff(e.target.value)}
                    disabled={searching}
                    title="最高段位"
                >
                    {DIFFICULTY_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.value} {getDifficultyShort(o.value)}</option>
                    ))}
                </select>
                <span className="history-config-label">~</span>
                <select
                    value={bottomDiff}
                    onChange={e => setBottomDiff(e.target.value)}
                    disabled={searching}
                    title="最低段位"
                >
                    {DIFFICULTY_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.value} {getDifficultyShort(o.value)}</option>
                    ))}
                </select>
                <span className="history-config-label">周</span>
                <select
                    className="history-week-select"
                    value={toWeek == null ? '' : toWeek}
                    onChange={e => setToWeek(Number(e.target.value))}
                    disabled={searching}
                    title="结束周"
                >
                    {weekOptionsList.map(w => <option key={w} value={w}>第{w}周</option>)}
                </select>
                <span className="history-config-label">~</span>
                <select
                    className="history-week-select"
                    value={fromWeek == null ? '' : fromWeek}
                    onChange={e => setFromWeek(Number(e.target.value))}
                    disabled={searching}
                    title="起始周"
                >
                    {weekOptionsList.map(w => <option key={w} value={w}>第{w}周</option>)}
                </select>
                <button className="refresh-btn" onClick={search} disabled={searching}>
                    {searching ? '查询中…' : '查询'}
                </button>
            </div>
            <div className="history-tip">段位范围越宽查询越多（每段位一榜），建议 2~3 个相邻段位</div>
            {rangeError && <div className="history-empty">{rangeError}</div>}
            {searching && <div className="history-loading">{progress}</div>}
            {!searching && rows.length === 0 && progress && <div className="history-empty">{progress}</div>}
            {!searching && rows.length > 0 && (
                <>
                    <div className="history-summary">{progress}</div>
                    <div className="history-list">
                        {rows.map(r => <HistoryRow key={r.week} row={r} />)}
                    </div>
                </>
            )}
        </Modal>
    );
}
