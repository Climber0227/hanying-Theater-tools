import React from 'react';

export default function RankingToolbar({ searchQuery, setSearchQuery, onBracket, onTeam, onRanking }) {
    return (
        <div className="ranking-toolbar">
            <input
                type="text"
                className="ranking-search"
                placeholder="搜索玩家ID或名字"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
            />
            <button className="bracket-btn" onClick={onBracket}>分数分布</button>
            <button className="bracket-btn" onClick={onTeam}>阵容参考</button>
            <button className="bracket-btn" onClick={onRanking}>阵容排行</button>
        </div>
    );
}
