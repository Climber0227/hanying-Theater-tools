import React from 'react';

export const RANK_OPTIONS = [
    { value: '', label: '-' },
    { value: '3', label: 'S' },
    { value: '4', label: 'SS' },
    { value: '5', label: 'SSS' },
    { value: '6', label: 'SSS+' }
];

export const RANK_LABEL = RANK_OPTIONS.reduce((m, o) => { if (o.value) m[o.value] = o.label; return m; }, {});

function FunnelIcon() {
    return (
        <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
            <path d="M1.5 2.2h9L7.3 6.4v3.6L4.7 11V6.4z" fill="currentColor" opacity=".85" />
        </svg>
    );
}

// 手机端排序行（筛选已收进工具条弹层）
const ZONE_COLORS = ['#3f6ecb', '#cf3d3d', '#b07a12'];

function MobileSortRow({ zones, sortKey, sortAsc, toggleSort }) {
    const arrow = key => (sortKey === key ? (sortAsc ? '↑' : '↓') : '');
    // 默认按总分降序（服务端顺序），所以未显式排序时总分就是激活态
    const totalActive = !sortKey || sortKey === 'total';
    const totalArrow = sortKey === 'total' ? (sortAsc ? '↑' : '↓') : !sortKey ? '↓' : '';
    return (
        <div className="mobile-sort-row">
            {zones.map((zone, i) => (
                <button
                    key={zone.id}
                    className={`mobile-sort-btn${sortKey === String(i) ? ' active' : ''}`}
                    onClick={() => toggleSort(String(i))}
                >
                    <span className="zone-dot" style={{ background: ZONE_COLORS[i % ZONE_COLORS.length] }} />
                    {zone.name}{arrow(String(i)) && <span className="sort-arrow">{arrow(String(i))}</span>}
                </button>
            ))}
            <button
                className={`mobile-sort-btn${totalActive ? ' active' : ''}`}
                onClick={() => toggleSort('total')}
            >
                总分{totalArrow && <span className="sort-arrow">{totalArrow}</span>}
            </button>
        </div>
    );
}

export default function RankingHeader({ zones, sortKey, sortAsc, toggleSort, isMobile, onToggleFilter, activeZones }) {
    if (isMobile) {
        return <MobileSortRow zones={zones} sortKey={sortKey} sortAsc={sortAsc} toggleSort={toggleSort} />;
    }

    const sortArrow = key => (sortKey === key ? (sortAsc ? '↑' : '↓') : '');

    return (
        <div className="ranking-header">
            <div className="col-rank">排名</div>
            <div className="col-player">玩家</div>
            {zones.map((zone, i) => (
                <div className="col-zone" key={zone.id}>
                    <button
                        className={`col-sort${sortKey === String(i) ? ' active' : ''}`}
                        onClick={() => toggleSort(String(i))}
                    >
                        <span className="zone-dot" style={{ background: ZONE_COLORS[i % ZONE_COLORS.length] }} />
                        {zone.name}
                        <span className="sort-arrow">{sortArrow(String(i))}</span>
                    </button>
                    <button
                        className={`col-funnel${activeZones && activeZones[i] ? ' active' : ''}`}
                        onClick={() => onToggleFilter && onToggleFilter()}
                        title="按该区角色阶级筛选"
                        aria-label="筛选"
                    >
                        <FunnelIcon />
                    </button>
                </div>
            ))}
            <div className={`col-total${sortKey === 'total' ? ' active' : ''}`}>
                <button className="col-sort" onClick={() => toggleSort('total')}>
                    总分<span className="sort-arrow">{sortArrow('total')}</span>
                </button>
            </div>
        </div>
    );
}
