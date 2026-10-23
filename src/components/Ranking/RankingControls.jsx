import React from 'react';

// 周选择（难度已移到页头分段控件）
export default function RankingControls({ week, setWeek, weekOptions }) {
    const weeks = [];
    if (weekOptions.min != null && weekOptions.max != null) {
        for (let w = weekOptions.max; w >= weekOptions.min; w--) {
            weeks.push(w);
        }
    }

    return (
        <select
            className="week-select"
            value={week == null ? '' : String(week)}
            onChange={e => setWeek(e.target.value === '' ? null : parseInt(e.target.value))}
            aria-label="选择周"
        >
            <option value="">本周</option>
            {weeks.map(w => <option key={w} value={w}>第 {w} 周</option>)}
        </select>
    );
}
