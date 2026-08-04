import React, { useEffect, useMemo, useRef, useState } from 'react';
import { List } from 'react-window';
import RankingRow, { ROW_HEIGHT } from './RankingRow.jsx';
import { computeTeamMaxScores } from '../../utils/ranking.js';

// 列宽常量（与 CSS 保持一致）
const COL_RANK = 80;
const COL_PLAYER = 220;
const COL_ZONE = 268; // 240 min-width + 28 padding
const COL_TOTAL = 160;
const COL_RESET = 56;

export default function VirtualRankingTable({ rows, zones, prevSnapshot, header, onOpenPlayer, onOpenAnalysis, onOpenTrend }) {
    const wrapRef = useRef(null);
    const [wrapHeight, setWrapHeight] = useState(640);
    const [headerH, setHeaderH] = useState(114);

    const tableWidth = COL_RANK + COL_PLAYER + (zones || []).length * COL_ZONE + COL_TOTAL + COL_RESET;

    useEffect(() => {
        const el = wrapRef.current;
        if (!el) return;
        const update = () => {
            setWrapHeight(el.clientHeight);
            const h = el.querySelector('.ranking-header');
            if (h) setHeaderH(h.offsetHeight);
        };
        update();
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, [zones]);

    const teamMax = useMemo(() => computeTeamMaxScores(rows, zones), [rows, zones]);
    const totalMaxScore = useMemo(() => rows.reduce((m, r) => Math.max(m, r.score || 0), 0), [rows]);

    const listHeight = Math.max(wrapHeight - headerH, 120);

    return (
        <div className="ranking-table" ref={wrapRef}>
            <div style={{ width: tableWidth, minWidth: '100%' }}>
                {header}
                <List
                    rowCount={rows.length}
                    rowHeight={ROW_HEIGHT}
                    rowComponent={RankingRow}
                    rowProps={{
                        rows,
                        zones,
                        teamMax,
                        totalMaxScore,
                        prevSnapshot,
                        onOpenPlayer,
                        onOpenAnalysis,
                        onOpenTrend
                    }}
                    defaultHeight={listHeight}
                    style={{ height: listHeight }}
                    overscanCount={2}
                />
            </div>
        </div>
    );
}
