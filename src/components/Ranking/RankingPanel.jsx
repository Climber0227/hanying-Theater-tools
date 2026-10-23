import React, { lazy, Suspense, useCallback, useMemo, useState } from 'react';
import { useRankings } from '../../hooks/useRankings.js';
import useMediaQuery, { MOBILE_QUERY } from '../../hooks/useMediaQuery.js';
import { computeTeamMaxScores } from '../../utils/ranking.js';
import { getDifficultyLabel } from '../../api/config.js';
import RankingControls from './RankingControls.jsx';
import RankingToolbar from './RankingToolbar.jsx';
import RankingHeader, { RANK_OPTIONS, RANK_LABEL } from './RankingHeader.jsx';
import VirtualRankingTable from './VirtualRankingTable.jsx';

// 弹窗懒加载（含 Recharts 的大依赖按需加载）
const BracketModal = lazy(() => import('../Modals/BracketModal.jsx'));
const TeamModal = lazy(() => import('../Modals/TeamModal.jsx'));
const RankingModal = lazy(() => import('../Modals/RankingModal.jsx'));
const SaModal = lazy(() => import('../Modals/SaModal.jsx'));
const CurveModal = lazy(() => import('../Modals/CurveModal.jsx'));
const PlayerRankModal = lazy(() => import('../Modals/PlayerRankModal.jsx'));

const MODAL_FALLBACK = null;

// 2026-10-23T10:31:00.001381Z → 10-23 10:31
function shortUpdated(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const p = n => String(n).padStart(2, '0');
    return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function RankingPanel({ warzone, onOpenPlayer }) {
    const { difficulty, week, setWeek, zones, rankings, meta, weekOptions, prevSnapshot, loading, error, refresh, refreshForce, currentWeek } = warzone;
    const rk = useRankings(rankings, zones);
    const isMobile = useMediaQuery(MOBILE_QUERY);

    const [modal, setModal] = useState(null); // 'bracket' | 'team' | 'ranking'
    const [filterOpen, setFilterOpen] = useState(false);
    const [saTarget, setSaTarget] = useState(null);
    const [curveTarget, setCurveTarget] = useState(null);
    const [playerRankTarget, setPlayerRankTarget] = useState(null);

    // 阵容最高分必须基于全量榜单计算（不受筛选/排序/TOP100 截断影响）
    const teamMax = useMemo(() => computeTeamMaxScores(rankings, zones), [rankings, zones]);

    const activeFilters = useMemo(() => {
        const flags = [];
        const chips = [];
        (zones || []).forEach((zone, i) => {
            const vals = rk.charFilters[i] || ['', '', ''];
            const labels = vals
                .map((v, ci) => (v ? `${ci + 1}号位 ${RANK_LABEL[v]}` : null))
                .filter(Boolean);
            flags.push(labels.length > 0);
            if (labels.length > 0) chips.push({ index: i, zone, labels });
        });
        return { flags, chips };
    }, [zones, rk.charFilters]);

    const filterCount = activeFilters.chips.reduce((n, c) => n + c.labels.length, 0);
    const updatedLabel = shortUpdated(meta.updatedAt);
    const showSkeleton = loading && (rankings || []).length === 0;
    const rows = rk.filtered || [];

    // 稳定回调（避免虚拟列表行全量重渲染）
    const openAnalysis = useCallback((playerId, zi) => {
        const ranking = (rankings || []).find(r => r && r.player && String(r.player.id) === String(playerId));
        if (ranking) setSaTarget({ ranking, zoneIndex: zi });
    }, [rankings]);
    const openTrend = useCallback((pid, zi) => {
        const ranking = (rankings || []).find(r => r && r.player && String(r.player.id) === String(pid));
        setCurveTarget({ playerId: pid, playerName: ranking && ranking.player ? ranking.player.name : null, zoneIndex: zi });
    }, [rankings]);
    const openMobileRow = useCallback(ranking => { setPlayerRankTarget(ranking); }, []);

    const hasData = (rankings || []).length > 0;

    return (
        <div className="rankings">
            <div className="panel-head">
                <div className="panel-title">
                    <h2>排行榜</h2>
                    <span className="top-label">TOP 100</span>
                    {updatedLabel && <span className="panel-sub">更新于 {updatedLabel}</span>}
                    {loading && <span className="panel-sub">同步中…</span>}
                </div>
                <div className="panel-tools">
                    <RankingControls week={week} setWeek={setWeek} weekOptions={weekOptions} />
                    <button className="refresh-btn" onClick={refreshForce} disabled={loading}>
                        {loading ? '刷新中' : '刷新'}
                    </button>
                </div>
            </div>

            {error && (
                <div className="data-alert" role="status">
                    <span className="data-alert-text">
                        {getDifficultyLabel(difficulty)}：{error}
                        {hasData ? '，当前显示的是上一次成功加载的数据' : ''}
                    </span>
                    <button className="data-alert-btn" onClick={refreshForce} disabled={loading}>
                        {loading ? '重试中…' : '重试'}
                    </button>
                </div>
            )}

            <RankingToolbar
                searchQuery={rk.searchQuery}
                setSearchQuery={rk.setSearchQuery}
                onBracket={() => setModal('bracket')}
                onTeam={() => setModal('team')}
                onRanking={() => setModal('ranking')}
                onToggleFilter={() => setFilterOpen(o => !o)}
                filterCount={filterCount}
                filterOpen={filterOpen}
            />

            {filterOpen && isMobile && (
                <div className="filter-sheet-backdrop" onClick={() => setFilterOpen(false)} />
            )}

            {filterOpen && (
                <div className="filter-pop">
                    <div className="filter-pop-head">
                        <div>
                            <div className="filter-pop-title">角色阶级筛选</div>
                            <div className="filter-pop-note">各区 3 个位置独立筛选，3.1 / 3.2 均视为 SSS</div>
                        </div>
                        <button className="reset-filter-btn" onClick={rk.resetFilters}>重置</button>
                    </div>
                    <div className="filter-zones">
                        {(zones || []).map((zone, i) => (
                            <div className="filter-zone" key={zone.id}>
                                <div className="filter-zone-name">{zone.name}</div>
                                <div className="filter-slots">
                                    {[0, 1, 2].map(ci => (
                                        <select
                                            key={ci}
                                            className="char-slot-select"
                                            value={(rk.charFilters[i] || ['', '', ''])[ci] || ''}
                                            onChange={e => rk.setCharFilter(i, ci, e.target.value)}
                                            aria-label={`${zone.name} ${ci + 1}号位阶级`}
                                        >
                                            {RANK_OPTIONS.map(o => (
                                                <option key={o.value} value={o.value}>
                                                    {ci + 1}号位 {o.label}
                                                </option>
                                            ))}
                                        </select>
                                    ))}
                                </div>
                                <div className="zone-quick-filters">
                                    <button className="zone-quick-btn" onClick={() => rk.setZoneQuick(i, '5')}>全 SSS</button>
                                    <button className="zone-quick-btn" onClick={() => rk.setZoneQuick(i, '6')}>全 SSS+</button>
                                </div>
                            </div>
                        ))}
                    </div>
                    {isMobile && (
                        <button className="sheet-done" onClick={() => setFilterOpen(false)}>完成</button>
                    )}
                </div>
            )}

            {activeFilters.chips.length > 0 && (
                <div className="filter-chips">
                    {activeFilters.chips.map(c => (
                        <button
                            className="filter-chip"
                            key={c.index}
                            onClick={() => rk.setZoneQuick(c.index, '')}
                            title="清除该区筛选"
                        >
                            {c.zone.name} · {c.labels.join(' / ')}
                            <span className="chip-x">×</span>
                        </button>
                    ))}
                    <button className="clear-all-btn" onClick={rk.resetFilters}>清除全部</button>
                </div>
            )}

            {showSkeleton ? (
                <div className="ranking-table" style={{ height: 'auto' }}>
                    <div className="skeleton-table">
                        {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
                            <div className="skeleton-row" key={i}>
                                <div className="skeleton" style={{ width: 40, flexShrink: 0 }} />
                                <div className="skeleton" style={{ width: 170, flexShrink: 0 }} />
                                <div className="skeleton" style={{ flex: 1 }} />
                                <div className="skeleton" style={{ flex: 1 }} />
                                <div className="skeleton" style={{ flex: 1 }} />
                                <div className="skeleton" style={{ width: 110, flexShrink: 0 }} />
                            </div>
                        ))}
                    </div>
                </div>
            ) : !hasData && error ? (
                <div className="ranking-empty">
                    <div className="ranking-empty-title">数据加载失败</div>
                    <div className="ranking-empty-sub">{error}</div>
                    <button className="reset-filter-btn" onClick={refresh} disabled={loading}>
                        {loading ? '重试中…' : '重试'}
                    </button>
                </div>
            ) : rows.length === 0 ? (
                <div className="ranking-empty">
                    <div className="ranking-empty-title">没有匹配的玩家</div>
                    <div className="ranking-empty-sub">试试清空搜索关键词或角色阶级筛选</div>
                    <button className="reset-filter-btn" onClick={rk.resetFilters}>重置全部条件</button>
                </div>
            ) : (
                <VirtualRankingTable
                    rows={rows}
                    zones={zones}
                    teamMax={teamMax}
                    prevSnapshot={prevSnapshot}
                    header={
                        <RankingHeader
                            zones={zones}
                            sortKey={rk.sortKey}
                            sortAsc={rk.sortAsc}
                            toggleSort={rk.toggleSort}
                            isMobile={isMobile}
                            onToggleFilter={() => setFilterOpen(o => !o)}
                            activeZones={activeFilters.flags}
                        />
                    }
                    onOpenPlayer={onOpenPlayer}
                    onOpenAnalysis={openAnalysis}
                    onOpenTrend={openTrend}
                    onOpenMobileRow={openMobileRow}
                />
            )}

            <div className="panel-foot">
                <span>仅统计本周有战绩的账号 · 分数来自游戏内排行榜</span>
                <span>1 — {rows.length} / {meta.members ? meta.members.toLocaleString() : '—'}</span>
            </div>

            <Suspense fallback={MODAL_FALLBACK}>
                {modal === 'bracket' && (
                    <BracketModal rankings={rankings} zones={zones} difficulty={difficulty} onClose={() => setModal(null)} />
                )}
                {modal === 'team' && (
                    <TeamModal rankings={rankings} zones={zones} onClose={() => setModal(null)} />
                )}
                {modal === 'ranking' && (
                    <RankingModal rankings={rankings} zones={zones} onClose={() => setModal(null)} />
                )}
                {saTarget && (
                    <SaModal
                        ranking={saTarget.ranking}
                        zoneIndex={saTarget.zoneIndex}
                        rankings={rankings}
                        zones={zones}
                        onClose={() => setSaTarget(null)}
                    />
                )}
                {curveTarget && (
                    <CurveModal
                        playerId={curveTarget.playerId}
                        playerName={curveTarget.playerName}
                        zoneIndex={curveTarget.zoneIndex}
                        difficulty={difficulty}
                        currentWeek={currentWeek}
                        zones={zones}
                        onClose={() => setCurveTarget(null)}
                    />
                )}
                {playerRankTarget && (
                    <PlayerRankModal
                        ranking={playerRankTarget}
                        zones={zones}
                        prevSnapshot={prevSnapshot}
                        teamMax={teamMax}
                        onClose={() => setPlayerRankTarget(null)}
                        onOpenPlayer={onOpenPlayer}
                        onOpenAnalysis={openAnalysis}
                        onOpenTrend={openTrend}
                    />
                )}
            </Suspense>
        </div>
    );
}
