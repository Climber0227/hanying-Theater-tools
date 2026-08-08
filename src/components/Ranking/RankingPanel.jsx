import React, { lazy, Suspense, useCallback, useMemo, useState } from 'react';
import { useRankings } from '../../hooks/useRankings.js';
import { computeTeamMaxScores } from '../../utils/ranking.js';
import RankingControls from './RankingControls.jsx';
import RankingToolbar from './RankingToolbar.jsx';
import RankingHeader from './RankingHeader.jsx';
import VirtualRankingTable from './VirtualRankingTable.jsx';

// 弹窗懒加载（含 Recharts 的大依赖按需加载）
const BracketModal = lazy(() => import('../Modals/BracketModal.jsx'));
const TeamModal = lazy(() => import('../Modals/TeamModal.jsx'));
const RankingModal = lazy(() => import('../Modals/RankingModal.jsx'));
const SaModal = lazy(() => import('../Modals/SaModal.jsx'));
const CurveModal = lazy(() => import('../Modals/CurveModal.jsx'));
const PlayerRankModal = lazy(() => import('../Modals/PlayerRankModal.jsx'));

const MODAL_FALLBACK = null;

export default function RankingPanel({ warzone, onOpenPlayer }) {
    const { difficulty, setDifficulty, week, setWeek, zones, rankings, meta, weekOptions, prevSnapshot, loading, error, refresh, refreshForce, currentWeek } = warzone;
    const rk = useRankings(rankings, zones);

    const [modal, setModal] = useState(null); // 'bracket' | 'team' | 'ranking'
    const [saTarget, setSaTarget] = useState(null); // { ranking, zoneIndex }
    const [curveTarget, setCurveTarget] = useState(null); // { playerId, playerName, zoneIndex }
    const [playerRankTarget, setPlayerRankTarget] = useState(null); // { ranking }（手机端行点击）

    const teamMax = useMemo(() => computeTeamMaxScores(rk.filtered, zones), [rk.filtered, zones]);

    // 稳定回调（避免虚拟列表行全量重渲染）
    const openAnalysis = useCallback((playerId, zi) => {
        const ranking = (rankings || []).find(r => r && r.player && String(r.player.id) === String(playerId));
        if (ranking) setSaTarget({ ranking, zoneIndex: zi });
    }, [rankings]);
    const openTrend = useCallback((pid, zi) => {
        setCurveTarget({ playerId: pid, playerName: null, zoneIndex: zi });
    }, []);

    // 手机端行点击 → PlayerRankModal
    const openMobileRow = useCallback(ranking => {
        setPlayerRankTarget(ranking);
    }, []);

    if (error) {
        return <div className="team-empty">加载失败：{error}</div>;
    }

    return (
        <div className="rankings">
            <RankingControls
                difficulty={difficulty}
                setDifficulty={setDifficulty}
                week={week}
                setWeek={setWeek}
                weekOptions={weekOptions}
                meta={meta}
            />
            <h2>
                排行榜 <span className="top-label">TOP 100</span>
                <button className="refresh-btn" onClick={refreshForce} disabled={loading}>刷新</button>
                {loading && <span className="top-label">加载中…</span>}
            </h2>
            <div className="filter-hint">
                角色阶级筛选：各区3个下拉框独立筛选对应位置的阶级（3.1/3.2均视为SSS），<b>[全SSS]</b>/<b>[全SSS+]</b>快速将该区3个角色位统一设定
            </div>
            <RankingToolbar
                searchQuery={rk.searchQuery}
                setSearchQuery={rk.setSearchQuery}
                onBracket={() => setModal('bracket')}
                onTeam={() => setModal('team')}
                onRanking={() => setModal('ranking')}
            />
            {loading ? (
                <div className="ranking-table" style={{ height: 'auto' }}>
                    <div className="skeleton-table">
                        {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
                            <div className="skeleton-row" key={i}>
                                <div className="skeleton" style={{ width: 56, flexShrink: 0 }} />
                                <div className="skeleton" style={{ width: 180, flexShrink: 0 }} />
                                <div className="skeleton" style={{ flex: 1 }} />
                                <div className="skeleton" style={{ flex: 1 }} />
                                <div className="skeleton" style={{ flex: 1 }} />
                                <div className="skeleton" style={{ width: 120, flexShrink: 0 }} />
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <VirtualRankingTable
                    rows={rk.filtered}
                    zones={zones}
                    prevSnapshot={prevSnapshot}
                    header={
                        <RankingHeader
                            zones={zones}
                            charFilters={rk.charFilters}
                            setCharFilter={rk.setCharFilter}
                            setZoneQuick={rk.setZoneQuick}
                            sortKey={rk.sortKey}
                            sortAsc={rk.sortAsc}
                            toggleSort={rk.toggleSort}
                            onReset={rk.resetFilters}
                        />
                    }
                    onOpenPlayer={onOpenPlayer}
                    onOpenAnalysis={openAnalysis}
                    onOpenTrend={openTrend}
                    onOpenMobileRow={openMobileRow}
                />
            )}
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
