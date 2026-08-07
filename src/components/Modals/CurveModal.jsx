import React, { useEffect, useState } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import Modal from './Modal.jsx';
import { getPlayerCurve } from '../../api/storage.js';
import { formatNumber, formatScoreCompact, fmtTime, getMondayStart } from '../../utils/format.js';

const WEEK_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const ZONE_COLORS = ['#0a84ff', '#ff9f0a', '#bf5af2'];

function dayLabel(ts) {
    const d = new Date(ts);
    return WEEK_NAMES[(d.getDay() || 7) - 1];
}

// 采样 → 图表行（三区单独字段，0 分视为缺失）
function toRow(s) {
    const r = { time: s.t, z0: null, z1: null, z2: null };
    (s.zones || []).forEach((v, i) => {
        if (i < 3 && v > 0) r['z' + i] = v;
    });
    return r;
}

// 单张多区曲线图：标题 + 图例 + 折线
function CurveChart({ title, data, zones, mode, hasData }) {
    return (
        <div className="curve-chart">
            <div className="curve-chart-title">
                <span>{title}</span>
            </div>
            <div className="chart-legend">
                {(zones || []).map((z, i) => (
                    <span className="chart-legend-item" key={z.id || i}>
                        <span className="chart-legend-dot" style={{ background: ZONE_COLORS[i] }} />
                        {z.name}
                    </span>
                ))}
            </div>
            {hasData ? (
                <ResponsiveContainer width="100%" height={170}>
                    <LineChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.07)" />
                        <XAxis
                            dataKey="label"
                            tick={{ fontSize: 11, fill: '#86868b' }}
                            tickLine={false}
                            axisLine={{ stroke: 'rgba(0,0,0,0.1)' }}
                            interval="preserveStartEnd"
                        />
                        <YAxis
                            tickFormatter={formatScoreCompact}
                            tick={{ fontSize: 10, fill: '#86868b' }}
                            tickLine={false}
                            axisLine={false}
                            width={48}
                            domain={['auto', 'auto']}
                        />
                        <Tooltip
                            cursor={{ stroke: 'rgba(0,0,0,0.25)', strokeDasharray: '4 4' }}
                            content={({ active, payload, label }) => {
                                if (!active || !payload || !payload.length) return null;
                                const p = payload[0].payload;
                                return (
                                    <div className="chart-tooltip">
                                        <div className="chart-tooltip-label">
                                            {mode === 'today' ? `今日 ${label}` : `${label} ${fmtTime(p.time)}`}
                                        </div>
                                        {payload.map((entry, i) => (
                                            entry.value != null ? (
                                                <div className="chart-tooltip-row" key={i}>
                                                    <span className="chart-tooltip-indicator" style={{ background: entry.color }} />
                                                    <span className="chart-tooltip-name">{entry.name}</span>
                                                    <span className="chart-tooltip-value">{formatNumber(entry.value)}</span>
                                                </div>
                                            ) : null
                                        ))}
                                    </div>
                                );
                            }}
                        />
                        {(zones || []).map((z, i) => (
                            <Line
                                key={z.id || i}
                                type="monotone"
                                dataKey={`z${i}`}
                                name={z.name}
                                stroke={ZONE_COLORS[i]}
                                strokeWidth={2}
                                dot={{ r: 3, fill: '#fff', stroke: ZONE_COLORS[i], strokeWidth: 2 }}
                                activeDot={{ r: 5, fill: '#fff', stroke: ZONE_COLORS[i], strokeWidth: 2 }}
                                connectNulls
                                animationDuration={700}
                                animationEasing="ease-out"
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            ) : (
                <div className="team-empty">暂无数据，数据会随榜单每 30 分钟自动刷新时记录</div>
            )}
            <div className="curve-chart-axis">
                <span>{mode === 'today' ? '00:00' : '周一'}</span>
                <span>{mode === 'today' ? '24:00' : '周日'}</span>
            </div>
        </div>
    );
}

// 玩家趋势曲线：三区合并两张图——今日（按小时）/ 本周（按天），不同颜色区分各区
// 数据源：后端共享优先（/api/curve），本地 localStorage 采样兜底
export default function CurveModal({ playerId, playerName, difficulty, currentWeek, zones, onClose }) {
    const [serverSamples, setServerSamples] = useState(null); // null = 加载中/无服务端数据
    const zoneList = zones || [];

    // 服务端曲线（异步加载，成功后自动切换数据源）
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const resp = await fetch(`/api/curve?player=${playerId}&difficulty=${difficulty}&week=${currentWeek}`);
                const result = await resp.json();
                if (!cancelled && result.status === 'success' && Array.isArray(result.samples) && result.samples.length > 0) {
                    setServerSamples(result.samples);
                } else if (!cancelled) {
                    setServerSamples([]);
                }
            } catch {
                if (!cancelled) setServerSamples([]);
            }
        })();
        return () => { cancelled = true; };
    }, [playerId, difficulty, currentWeek]);

    const localSamples = getPlayerCurve(playerId, difficulty, currentWeek);
    const samples = serverSamples && serverSamples.length > 0 ? serverSamples : localSamples;

    // 今日（按小时）
    const todayData = (() => {
        const now = new Date();
        const startT = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const endT = startT + 24 * 3600 * 1000;
        return samples
            .filter(s => s.t >= startT && s.t < endT)
            .map(s => ({ ...toRow(s), label: fmtTime(s.t) }))
            .sort((a, b) => a.time - b.time);
    })();

    // 本周（按天，每天取最后一条采样）
    const weekData = (() => {
        const startT = getMondayStart(new Date());
        const byDay = {};
        samples
            .filter(s => s.t >= startT)
            .forEach(s => {
                const d = new Date(s.t);
                const dayKey = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
                byDay[dayKey] = s;
            });
        return Object.values(byDay)
            .map(s => ({ ...toRow(s), label: dayLabel(s.t) }))
            .sort((a, b) => a.time - b.time);
    })();

    const hasAny = (data) => data.some(d => d.z0 != null || d.z1 != null || d.z2 != null);
    const todayHas = hasAny(todayData) && todayData.length >= 2;
    const weekHas = hasAny(weekData) && weekData.length >= 2;

    return (
        <Modal
            title={`${playerName} 本周走势`}
            sub={`第${currentWeek}周 · 三区合并`}
            onClose={onClose}
            wide
        >
            <CurveChart title="今日趋势（按小时）" data={todayData} zones={zoneList} mode="today" hasData={todayHas} />
            <CurveChart title="本周趋势（按天）" data={weekData} zones={zoneList} mode="week" hasData={weekHas} />
        </Modal>
    );
}
