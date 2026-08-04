import React, { useState } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart
} from 'recharts';
import Modal from './Modal.jsx';
import { getPlayerCurve } from '../../api/storage.js';
import { formatNumber, formatScoreCompact, fmtTime, getMondayStart } from '../../utils/format.js';

const WEEK_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

function dayLabel(ts) {
    const d = new Date(ts);
    return WEEK_NAMES[(d.getDay() || 7) - 1];
}

// 玩家趋势曲线（Recharts）：今日按时 / 本周按天
export default function CurveModal({ playerId, playerName, zoneIndex, difficulty, currentWeek, zones, onClose, onSwitchZone }) {
    const [mode, setMode] = useState('today');
    const [zoneIdx, setZoneIdx] = useState(zoneIndex || 0);
    const zone = (zones || [])[zoneIdx];

    const samples = getPlayerCurve(playerId, difficulty, currentWeek);

    // 数据准备
    const now = new Date();
    let chartData = [];
    let startT;
    if (mode === 'today') {
        startT = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const endT = startT + 24 * 3600 * 1000;
        chartData = samples
            .map(s => ({ t: s.t, score: (s.zones && s.zones[zoneIdx]) || 0 }))
            .filter(p => p.score > 0 && p.t >= startT && p.t < endT)
            .map(p => ({ label: fmtTime(p.t), time: p.t, score: p.score }))
            .sort((a, b) => a.time - b.time);
    } else {
        startT = getMondayStart(now);
        const byDay = {};
        samples.forEach(s => {
            const d = new Date(s.t);
            const dayKey = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
            byDay[dayKey] = { t: s.t, score: (s.zones && s.zones[zoneIdx]) || 0 };
        });
        chartData = Object.values(byDay)
            .filter(p => p.score > 0)
            .map(p => ({ label: dayLabel(p.t), time: p.t, score: p.score }))
            .sort((a, b) => a.time - b.time);
    }

    const first = chartData.length ? chartData[0].score : 0;
    const last = chartData.length ? chartData[chartData.length - 1].score : 0;
    const diff = last - first;

    return (
        <Modal
            title={`${playerName} 本周走势`}
            sub={`第${currentWeek}周`}
            onClose={onClose}
            wide
        >
            <div className="team-tabs team-zone-tabs">
                {(zones || []).map((z, i) => (
                    <button
                        key={z.id || i}
                        className={`team-tab${i === zoneIdx ? ' active' : ''}`}
                        onClick={() => setZoneIdx(i)}
                    >
                        {z.name}
                    </button>
                ))}
            </div>
            <div className="team-tabs">
                <button className={`team-tab${mode === 'today' ? ' active' : ''}`} onClick={() => setMode('today')}>今日</button>
                <button className={`team-tab${mode === 'week' ? ' active' : ''}`} onClick={() => setMode('week')}>本周</button>
            </div>

            <div className="curve-chart">
                <div className="curve-chart-title">
                    <span>{zone ? zone.name : ''}</span>
                    <span className="curve-range">
                        {chartData.length ? `${formatNumber(first)} → ${formatNumber(last)}` : '暂无数据'}
                        {chartData.length >= 2 && diff !== 0 && (
                            <span className={diff > 0 ? 'score-delta-up' : 'score-delta-down'}>
                                {' '}{diff > 0 ? '+' : ''}{formatScoreCompact(diff)}
                            </span>
                        )}
                    </span>
                </div>
                {chartData.length >= 2 ? (
                    <ResponsiveContainer width="100%" height={160}>
                        <AreaChart data={chartData} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="curveFill" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#1d1d1f" stopOpacity={0.18} />
                                    <stop offset="100%" stopColor="#1d1d1f" stopOpacity={0} />
                                </linearGradient>
                            </defs>
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
                                content={({ active, payload, label }) => {
                                    if (!active || !payload || !payload.length) return null;
                                    const p = payload[0].payload;
                                    return (
                                        <div className="curve-tooltip-show">
                                            <div className="curve-tip-time">
                                                {mode === 'today' ? `今日 ${label}` : `${label} ${fmtTime(p.time)}`}
                                            </div>
                                            <div className="curve-tip-score">{formatNumber(p.score)}</div>
                                        </div>
                                    );
                                }}
                            />
                            <Area
                                type="monotone"
                                dataKey="score"
                                stroke="#1d1d1f"
                                strokeWidth={2.5}
                                fill="url(#curveFill)"
                                dot={{ r: 3, fill: '#fff', stroke: '#1d1d1f', strokeWidth: 2 }}
                                activeDot={{ r: 5 }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="team-empty">该区暂无数据，数据会随榜单每 30 分钟自动刷新时记录</div>
                )}
                <div className="curve-chart-axis">
                    <span>{mode === 'today' ? '00:00' : '周一'}</span>
                    <span>{mode === 'today' ? '24:00' : '周日'}</span>
                </div>
            </div>
        </Modal>
    );
}
