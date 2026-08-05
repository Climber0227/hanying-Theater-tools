import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Modal from './Modal.jsx';
import { computeBrackets } from '../../utils/modalData.js';
import { formatNumber, formatScoreCompact } from '../../utils/format.js';

// 分数分布：总分 + 各区（Recharts 柱状图，shadcn 视觉）
export default function BracketModal({ rankings, zones, difficulty, onClose }) {
    const [key, setKey] = useState('total');

    const data = useMemo(() => computeBrackets(rankings, zones, key), [rankings, zones, key]);
    const title = key === 'total' ? '总分' : (zones[parseInt(key)]?.name || '');

    const chartData = useMemo(() => {
        if (!data || !data.buckets) return [];
        return data.buckets.map(b => ({
            label: `${formatScoreCompact(b.from)}~${formatScoreCompact(b.to)}`,
            count: b.count
        }));
    }, [data]);

    return (
        <Modal title="分数分布" sub={`(第${difficulty}段位)`} onClose={onClose} wide>
            <div className="team-tabs">
                <button className={`team-tab${key === 'total' ? ' active' : ''}`} onClick={() => setKey('total')}>总分</button>
                {(zones || []).map((z, i) => (
                    <button key={z.id || i} className={`team-tab${key === String(i) ? ' active' : ''}`} onClick={() => setKey(String(i))}>
                        {z.name}
                    </button>
                ))}
            </div>

            {data && data.buckets.length > 0 ? (
                <>
                    <div className="bracket-title">{title}分布（{formatNumber(data.total)} 人）</div>
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.07)" vertical={false} />
                            <XAxis
                                dataKey="label"
                                tick={{ fontSize: 10, fill: '#86868b' }}
                                tickLine={false}
                                axisLine={{ stroke: 'rgba(0,0,0,0.1)' }}
                                interval={0}
                                angle={-30}
                                textAnchor="end"
                                height={46}
                            />
                            <YAxis
                                tick={{ fontSize: 10, fill: '#86868b' }}
                                tickLine={false}
                                axisLine={false}
                                width={30}
                                allowDecimals={false}
                            />
                            <Tooltip
                                cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                                content={({ active, payload }) => {
                                    if (!active || !payload || !payload.length) return null;
                                    const p = payload[0].payload;
                                    return (
                                        <div className="chart-tooltip">
                                            <div className="chart-tooltip-label">分数区间 {p.label}</div>
                                            <div className="chart-tooltip-row">
                                                <span className="chart-tooltip-indicator" />
                                                <span className="chart-tooltip-name">人数</span>
                                                <span className="chart-tooltip-value">{formatNumber(p.count)}</span>
                                            </div>
                                        </div>
                                    );
                                }}
                            />
                            <Bar
                                dataKey="count"
                                fill="#1d1d1f"
                                radius={[4, 4, 0, 0]}
                                maxBarSize={40}
                                animationDuration={500}
                                animationEasing="ease-out"
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </>
            ) : (
                <div className="bracket-empty">暂无数据</div>
            )}
        </Modal>
    );
}
