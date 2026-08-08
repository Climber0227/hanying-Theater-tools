import React, { useState } from 'react';

const RANK_OPTIONS = [
    { value: '', label: '-' },
    { value: '3', label: 'S' },
    { value: '4', label: 'SS' },
    { value: '5', label: 'SSS' },
    { value: '6', label: 'SSS+' }
];

// 手机端：折叠筛选面板（默认收起，展开后各区阶级下拉 + 快捷按钮）+ 常显排序行
function MobileFilterPanel({ zones, charFilters, setCharFilter, setZoneQuick, sortKey, sortAsc, toggleSort, onReset }) {
    const [open, setOpen] = useState(false);
    const arrow = key => (sortKey === key ? (sortAsc ? '▲' : '▼') : '');
    return (
        <>
            <div className="mobile-sort-row">
                {zones.map((zone, i) => (
                    <button
                        key={zone.id}
                        className={`mobile-sort-btn${sortKey === String(i) ? ' active' : ''}`}
                        onClick={() => toggleSort(String(i))}
                    >
                        {zone.name}{arrow(String(i)) && <span className="sort-arrow"> {arrow(String(i))}</span>}
                    </button>
                ))}
                <button
                    className={`mobile-sort-btn${sortKey === 'total' ? ' active' : ''}`}
                    onClick={() => toggleSort('total')}
                >
                    总分{arrow('total') && <span className="sort-arrow"> {arrow('total')}</span>}
                </button>
            </div>
            <div className="mobile-filter">
                <button className="mobile-filter-toggle" onClick={() => setOpen(o => !o)}>
                    筛选 {open ? '▴' : '▾'}
                </button>
                {open && (
                    <div className="mobile-filter-body">
                        {zones.map((zone, i) => (
                            <div className="mobile-filter-zone" key={zone.id}>
                                <div className="mobile-filter-zone-name">{zone.name}</div>
                                <div className="char-slot-filters">
                                    {[0, 1, 2].map(ci => (
                                        <select
                                            key={ci}
                                            className="char-slot-select"
                                            value={(charFilters[i] || ['', '', ''])[ci] || ''}
                                            onChange={e => setCharFilter(i, ci, e.target.value)}
                                        >
                                            {RANK_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                        </select>
                                    ))}
                                </div>
                                <div className="zone-quick-filters">
                                    <button className="zone-quick-btn" onClick={() => setZoneQuick(i, '5')}>全SSS</button>
                                    <button className="zone-quick-btn" onClick={() => setZoneQuick(i, '6')}>全SSS+</button>
                                </div>
                            </div>
                        ))}
                        <button className="reset-filter-btn" onClick={onReset}>重置筛选</button>
                    </div>
                )}
            </div>
        </>
    );
}

export default function RankingHeader({ zones, charFilters, setCharFilter, setZoneQuick, sortKey, sortAsc, toggleSort, onReset, isMobile }) {
    if (isMobile) {
        return <MobileFilterPanel zones={zones} charFilters={charFilters} setCharFilter={setCharFilter} setZoneQuick={setZoneQuick} sortKey={sortKey} sortAsc={sortAsc} toggleSort={toggleSort} onReset={onReset} />;
    }
    const arrow = key => (sortKey === key ? (sortAsc ? ' ▲' : ' ▼') : ' ⇅');
    return (
        <div className="ranking-header">
            <div className="col-rank">排名</div>
            <div className="col-player">玩家</div>
            {zones.map((zone, i) => (
                <div className="col-zone-detail" key={zone.id}>
                    <div className={`sortable${sortKey === String(i) ? ' active' : ''}`} onClick={() => toggleSort(String(i))}>
                        {zone.name}<span className="sort-arrow">{arrow(String(i))}</span>
                    </div>
                    <div className="char-slot-filters">
                        {[0, 1, 2].map(ci => (
                            <select
                                key={ci}
                                className="char-slot-select"
                                value={(charFilters[i] || ['', '', ''])[ci] || ''}
                                onChange={e => setCharFilter(i, ci, e.target.value)}
                            >
                                {RANK_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        ))}
                    </div>
                    <div className="zone-quick-filters">
                        <button className="zone-quick-btn" onClick={() => setZoneQuick(i, '5')}>全SSS</button>
                        <button className="zone-quick-btn" onClick={() => setZoneQuick(i, '6')}>全SSS+</button>
                    </div>
                </div>
            ))}
            <div className={`col-total sortable${sortKey === 'total' ? ' active' : ''}`} onClick={() => toggleSort('total')}>
                总分<span className="sort-arrow">{arrow('total')}</span>
            </div>
            <div className="col-reset"><button className="reset-filter-btn" onClick={onReset}>重置</button></div>
        </div>
    );
}
