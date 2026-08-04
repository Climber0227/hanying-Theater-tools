import React, { useState } from 'react';
import { useRankings } from '../../hooks/useRankings.js';
import RankingControls from './RankingControls.jsx';
import RankingToolbar from './RankingToolbar.jsx';
import RankingHeader from './RankingHeader.jsx';
import VirtualRankingTable from './VirtualRankingTable.jsx';

export default function RankingPanel({ warzone }) {
    const { difficulty, setDifficulty, week, setWeek, zones, rankings, meta, weekOptions, prevSnapshot, loading, error, refresh } = warzone;
    const rk = useRankings(rankings, zones);

    const [modal, setModal] = useState(null); // 'bracket' | 'team' | 'ranking'

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
                <button className="refresh-btn" onClick={refresh} disabled={loading}>刷新</button>
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
                onOpenPlayer={id => console.log('open player', id)}
                onOpenAnalysis={(ranking, zi) => console.log('analysis', ranking.player.id, zi)}
                onOpenTrend={(pid, zi) => console.log('trend', pid, zi)}
            />
        </div>
    );
}
