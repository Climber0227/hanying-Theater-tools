import React from 'react';
import { DIFFICULTY_OPTIONS } from '../../api/config.js';
import { formatNumber } from '../../utils/format.js';

export default function RankingControls({ difficulty, setDifficulty, week, setWeek, weekOptions, meta }) {
    const weeks = [];
    if (weekOptions.min != null && weekOptions.max != null) {
        for (let w = weekOptions.max; w >= weekOptions.min; w--) {
            weeks.push(w);
        }
    }

    return (
        <div className="ranking-head">
            <div className="controls ranking-controls">
                <select value={difficulty} onChange={e => setDifficulty(e.target.value)}>
                    {DIFFICULTY_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                </select>
                <select
                    className="week-select"
                    value={week == null ? '' : String(week)}
                    onChange={e => setWeek(e.target.value === '' ? null : parseInt(e.target.value))}
                >
                    <option value="">本周</option>
                    {weeks.map(w => <option key={w} value={w}>第{w}周</option>)}
                </select>
                <span className="date-range">{meta.dateRange}</span>
            </div>
            <div className="ranking-meta">
                <span>参与人数: {formatNumber(meta.members)}</span>
                <span>更新时间: {meta.updatedAt}</span>
            </div>
        </div>
    );
}
