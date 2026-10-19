import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Modal from './Modal.jsx';
import { loadPlayerHistory } from '../../api/history.js';
import { aggregateRoster, sortRoster, splitByVisibility } from '../../utils/roster.js';
import { getImageUrl } from '../../api/config.js';
import { formatNumber, getQualityInfo } from '../../utils/format.js';

const FILTERS = [
    { key: 'all', label: '全部' },
    { key: 'hidden', label: '隐藏角色' },
    { key: 'open', label: '已公开' }
];

const SORTS = [
    { key: 'rank', label: '阶级' },
    { key: 'count', label: '出场周数' },
    { key: 'bp', label: '战力' },
    { key: 'recent', label: '最近上榜' }
];

function fmtTime(ts) {
    try {
        return new Date(ts).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch {
        return '';
    }
}

function RosterCard({ c, isOpen, open, expanded, onToggle }) {
    return (
        <div
            className={`roster-card${isOpen ? ' is-open' : ' is-hidden-char'}${expanded ? ' is-expanded' : ''}`}
            onClick={onToggle}
            title={`${c.name}${c.frame ? ' · ' + c.frame : ''}｜最高 ${getQualityInfo(c.maxRank) || '—'} · 出场 ${c.count} 周 · 最高战力 ${formatNumber(c.maxBp)}`}
        >
            <div className="roster-card-head">
                {c.icon
                    ? <img className="roster-icon" src={getImageUrl(c.icon)} alt="" loading="lazy" decoding="async"
                        onError={e => { e.currentTarget.style.display = 'none'; }} />
                    : <div className="roster-icon roster-icon-empty" />}
                <div className="roster-card-main">
                    <div className="roster-card-name">
                        {c.name}
                        {c.frame && c.frame !== c.name && <span className="character-frame">{c.frame}</span>}
                    </div>
                    <div className="roster-card-meta">
                        {getQualityInfo(c.maxRank) && <span className={`quality-tag quality-${c.maxRank}`}>{getQualityInfo(c.maxRank)}</span>}
                        {c.maxBp > 0 && <span className="roster-bp">{formatNumber(c.maxBp)}</span>}
                        {isOpen && <span className="roster-open-tag">已公开</span>}
                    </div>
                    <div className="roster-card-sub">
                        {c.count} 周 · 最近第 {c.lastWeek} 周
                    </div>
                </div>
            </div>
            {expanded && (
                <div className="roster-detail">
                    <div className="roster-detail-row">
                        <span className="roster-detail-label">出场区</span>
                        <span>{[...new Set(c.zones.map(z => z.name).filter(Boolean))].join('、') || '—'}</span>
                    </div>
                    {c.cubName && (
                        <div className="roster-detail-row">
                            <span className="roster-detail-label">最近辅助机</span>
                            <span>{c.cubName}</span>
                        </div>
                    )}
                    <div className="roster-detail-row">
                        <span className="roster-detail-label">上榜周</span>
                        <span className="roster-weeks">
                            {c.weeks.slice(0, 12).map(w => <span className="roster-week" key={w}>{w}</span>)}
                            {c.weeks.length > 12 && <span className="roster-week roster-week-more">+{c.weeks.length - 12}</span>}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}

// 历届阵容反推：隐藏角色详情时，用历届 TOP100 上榜阵容还原角色阶级
export default function RosterModal({ player, characters, cached, onClose, onLoaded }) {
    const [data, setData] = useState(() => (cached && Array.isArray(cached.chars) ? cached : null));
    const [loading, setLoading] = useState(!data);
    const [error, setError] = useState('');
    const [elapsed, setElapsed] = useState(0);
    const [filter, setFilter] = useState('all');
    const [sort, setSort] = useState('rank');
    const [expanded, setExpanded] = useState(null);
    const runRef = useRef(0);
    const abortRef = useRef(null);

    const load = useCallback(async force => {
        const run = ++runRef.current;
        if (abortRef.current) abortRef.current.abort();
        const ac = new AbortController();
        abortRef.current = ac;
        setLoading(true);
        setError('');
        setElapsed(0);
        const t0 = Date.now();
        const timer = setInterval(() => {
            if (run === runRef.current) setElapsed(Math.round((Date.now() - t0) / 1000));
        }, 500);
        try {
            const weeks = await loadPlayerHistory(player.id, { signal: ac.signal, force });
            if (run !== runRef.current) return;
            if (!weeks.length) {
                setData(null);
                setError('没有查到该玩家的上榜记录（只统计进入 TOP100 的周）');
                return;
            }
            const agg = aggregateRoster(weeks);
            const full = { ...agg, at: Date.now() };
            setData(full);
            if (onLoaded) onLoaded(full);
        } catch (e) {
            if (run !== runRef.current) return;
            if (e && e.name === 'AbortError') return;
            setError(e && e.message ? e.message : '加载失败，请稍后重试');
        } finally {
            clearInterval(timer);
            if (run === runRef.current) setLoading(false);
        }
    }, [player.id, onLoaded]);

    useEffect(() => {
        if (!data) load(false);
        return () => { if (abortRef.current) abortRef.current.abort(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const groups = useMemo(
        () => splitByVisibility((data && data.chars) || [], characters),
        [data, characters]
    );
    const hiddenTotal = useMemo(
        () => (characters || []).filter(c => c && !c.visible).length,
        [characters]
    );

    const list = useMemo(() => {
        let arr = (data && data.chars) || [];
        if (filter === 'hidden') arr = groups.hidden;
        else if (filter === 'open') arr = groups.open;
        return sortRoster(arr, sort);
    }, [data, filter, sort, groups]);

    const counts = {
        all: (data && data.chars.length) || 0,
        hidden: groups.hidden.length,
        open: groups.open.length
    };

    const summary = data && data.summary;

    return (
        <Modal
            title={`${player.name} · 历届阵容反推`}
            sub="来自历届战区 TOP100 上阵阵容"
            onClose={onClose}
            wide
        >
            {loading && !data && (
                <div className="roster-loading">
                    <div className="roster-spinner" />
                    <div>正在拉取历届上榜记录…{elapsed > 0 ? ` ${elapsed}s` : ''}</div>
                    <div className="roster-loading-sub">源站首次拉取可能较慢（约 30–60 秒），之后会复用缓存</div>
                </div>
            )}

            {error && !data && (
                <div className="roster-error">
                    <div>{error}</div>
                    <button className="refresh-btn" onClick={() => load(true)}>重试</button>
                </div>
            )}

            {data && (
                <>
                    <div className="roster-summary">
                        <div className="roster-stat">
                            <b>{summary.unique}</b>
                            <span>反推角色</span>
                        </div>
                        <div className="roster-stat">
                            <b>{summary.weeks}</b>
                            <span>上榜周数</span>
                        </div>
                        <div className="roster-stat">
                            <b>
                                {hiddenTotal > 0
                                    ? <>{groups.hidden.length}<em>/{hiddenTotal}</em></>
                                    : groups.open.length}
                            </b>
                            <span>{hiddenTotal > 0 ? '隐藏角色覆盖' : '已公开角色'}</span>
                        </div>
                        <div className="roster-stat">
                            <b>{formatNumber(summary.maxBp)}</b>
                            <span>最高战力</span>
                        </div>
                    </div>

                    <div className="roster-rankline">
                        <span>阶级分布</span>
                        {Object.keys(summary.rankDist)
                            .map(Number)
                            .sort((a, b) => b - a)
                            .map(r => (
                                <span className="roster-rank-chip" key={r}>
                                    <em className={`quality-tag quality-${r}`}>{getQualityInfo(r) || '?'}</em>
                                    {summary.rankDist[r]}
                                </span>
                            ))}
                        <span className="roster-span">
                            第 {summary.minWeek}–{summary.maxWeek} 周
                            {data.at ? ` · 更新于 ${fmtTime(data.at)}` : ''}
                        </span>
                        <button
                            className="roster-refresh"
                            onClick={() => load(true)}
                            disabled={loading}
                            title="重新拉取源站数据"
                        >
                            {loading ? '更新中…' : '刷新'}
                        </button>
                    </div>

                    <div className="roster-toolbar">
                        <div className="roster-tabs">
                            {FILTERS.map(f => (
                                <button
                                    key={f.key}
                                    className={`team-tab${filter === f.key ? ' active' : ''}`}
                                    onClick={() => setFilter(f.key)}
                                    disabled={loading}
                                >
                                    {f.label}{counts[f.key] > 0 ? ` ${counts[f.key]}` : ''}
                                </button>
                            ))}
                        </div>
                        <div className="roster-sort">
                            <span className="roster-sort-label">排序</span>
                            <select value={sort} onChange={e => setSort(e.target.value)}>
                                {SORTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                            </select>
                        </div>
                    </div>

                    {list.length === 0 ? (
                        <div className="roster-empty">该分类下暂无角色</div>
                    ) : (
                        <div className="roster-grid">
                            {list.map(c => (
                                <RosterCard
                                    key={c.id}
                                    c={c}
                                    isOpen={groups.visible.has(String(c.id))}
                                    expanded={expanded === c.id}
                                    onToggle={() => setExpanded(expanded === c.id ? null : c.id)}
                                />
                            ))}
                        </div>
                    )}

                    <div className="roster-foot">
                        <div className="roster-note">
                            仅统计进入 TOP100 的周，阶级取历史最高观测值；未上阵过的角色无法反推。
                            反推结果已自动同步到角色列表。
                        </div>
                    </div>
                </>
            )}
        </Modal>
    );
}
