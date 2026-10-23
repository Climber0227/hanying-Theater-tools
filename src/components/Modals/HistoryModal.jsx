import React, { useEffect, useMemo, useRef, useState } from 'react';
import Modal from './Modal.jsx';
import { getDifficultyShort, getImageUrl } from '../../api/config.js';
import { loadPlayerHistory } from '../../api/history.js';
import { friendlyError } from '../../api/client.js';
import { formatNumber, extractZoneElement, getQualityInfo } from '../../utils/format.js';

const MAX_WEEKS = 20;

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
export default function HistoryModal({ playerId, playerName, weekOptions, onClose }) {
    const [rows, setRows] = useState([]);
    const [progress, setProgress] = useState('');
    const [searching, setSearching] = useState(false);
    const [fromWeek, setFromWeek] = useState(null);
    const [toWeek, setToWeek] = useState(null);
    const [rangeError, setRangeError] = useState('');
    const cancelledRef = useRef(false);

    const minWeek = weekOptions.min;
    const maxWeek = weekOptions.max;

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

        setProgress('正在获取历届战绩…');
        try {
            // 一次请求取回该玩家所有上榜周（约 100 周 / 300KB），不再逐周 × 逐段位探测
            const weeks = await loadPlayerHistory(playerId);
            if (cancelledRef.current) return;
            const results = weeks
                .filter(w => w.week >= f && w.week <= t)
                .map(w => ({
                    week: w.week,
                    difficulty: w.difficulty,
                    rank: w.rank,
                    score: w.score,
                    zones: w.zones,
                    zoneMeta: w.zoneMeta || []
                }))
                .sort((a, b) => a.week - b.week);
            if (cancelledRef.current) return;
            setRows(results);
            setProgress(results.length
                ? `共找到 ${results.length} 周上榜记录`
                : `第 ${f}–${t} 周没有上榜记录`);
        } catch (e) {
            if (!cancelledRef.current) {
                setRows([]);
                setProgress(friendlyError(e));
            }
        } finally {
            if (!cancelledRef.current) setSearching(false);
        }
    };

    return (
        <Modal
            title={`${playerName} 历史战绩`}
            sub={`一次请求取回全部上榜周 · 仅统计进入 TOP100 的周`}
            onClose={onClose}
            wide
        >
            <div className="history-config">
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
            <div className="history-tip">一次请求取回全部上榜周 · 段位自动识别 · 仅统计进入 TOP100 的周</div>
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
