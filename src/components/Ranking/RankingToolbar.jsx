import React from 'react';

export default function RankingToolbar({
    searchQuery,
    setSearchQuery,
    onBracket,
    onTeam,
    onRanking,
    onToggleFilter,
    filterCount = 0,
    filterOpen = false
}) {
    return (
        <div className="ranking-toolbar">
            <div className="ranking-search">
                <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
                    <circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M10.4 10.4 L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <input
                    type="text"
                    placeholder="搜索玩家 ID 或名字"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                />
            </div>
            <div className="toolbar-spacer" />
            <button className="tool-btn" onClick={onBracket}>分数分布</button>
            <button className="tool-btn" onClick={onTeam}>阵容参考</button>
            <button className="tool-btn" onClick={onRanking}>阵容排行</button>
            <button
                className={`filter-btn${filterOpen ? ' open' : ''}${filterCount > 0 ? ' has-filter' : ''}`}
                onClick={onToggleFilter}
                aria-expanded={filterOpen}
            >
                筛选{filterCount > 0 && <span className="fb-count">{filterCount}</span>}
            </button>
        </div>
    );
}
