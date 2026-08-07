import React, { useEffect, useMemo, useState } from 'react';
import Modal from './Modal.jsx';
import { getPlayerCurve } from '../../api/storage.js';
import { formatNumber, fmtTime, getMondayStart } from '../../utils/format.js';

const WEEK_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const ZONE_COLORS = ['#0a84ff', '#ff9f0a', '#bf5af2'];

const W = 800;
const H = 380;
const PAD_X = 60;
const PAD_TOP = 34;
const PAD_BOTTOM = 52;

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

// 平滑贝塞尔路径（参考 CleanWireframe 算法）
function smoothPath(points) {
    if (!points || points.length < 2) return '';
    let d = `M ${points[0].x},${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const next = points[i + 1];
        const cp1x = prev.x + (curr.x - prev.x) * 0.5;
        const cp1y = prev.y;
        const cp2x = curr.x - (next ? (next.x - curr.x) * 0.3 : 0);
        const cp2y = curr.y;
        d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${curr.x},${curr.y}`;
    }
    return d;
}

// 断点分段（某区某采样缺失时拆成多段路径）
function splitPoints(points) {
    const segs = [];
    let cur = [];
    points.forEach(p => {
        if (p == null) {
            if (cur.length >= 2) segs.push(cur);
            cur = [];
        } else {
            cur.push(p);
        }
    });
    if (cur.length >= 2) segs.push(cur);
    return segs;
}

// 单张多区曲线图（SVG 自绘：平滑曲线 + 入场动画 + hover 提示）
function CurveChart({ title, data, zones, mode, hasData }) {
    const [phase, setPhase] = useState(0); // 0 隐藏 → 1 区域 → 2 折线 → 3 数据点
    const [hovered, setHovered] = useState(null);

    useEffect(() => {
        setPhase(0);
        setHovered(null);
        const timers = [
            setTimeout(() => setPhase(1), 100),
            setTimeout(() => setPhase(2), 400),
            setTimeout(() => setPhase(3), 800)
        ];
        return () => timers.forEach(clearTimeout);
    }, [data]);

    if (!hasData) {
        return (
            <div className="curve-chart">
                <div className="curve-chart-title"><span>{title}</span></div>
                <div className="chart-legend">
                    {(zones || []).map((z, i) => (
                        <span className="chart-legend-item" key={z.id || i}>
                            <span className="chart-legend-dot" style={{ background: ZONE_COLORS[i] }} />
                            {z.name}
                        </span>
                    ))}
                </div>
                <div className="team-empty">暂无数据，数据会随榜单每 30 分钟自动刷新时记录</div>
            </div>
        );
    }

    const n = data.length;
    const maxV = Math.max(...data.flatMap(d => [d.z0, d.z1, d.z2].filter(v => v != null))) * 1.08;
    const px = i => PAD_X + (i / (n - 1)) * (W - PAD_X * 2);
    const py = v => PAD_TOP + (1 - v / maxV) * (H - PAD_TOP - PAD_BOTTOM);
    const chartW = W - PAD_X * 2;
    const chartH = H - PAD_TOP - PAD_BOTTOM;

    const series = (zones || []).map((z, si) => ({
        z,
        si,
        color: ZONE_COLORS[si],
        segs: splitPoints(data.map(d => {
            const v = d['z' + si];
            return v != null ? { x: px(d._i), y: py(v) } : null;
        }))
    }));

    // hover 列坐标（用于 tooltip 定位）
    const hoverX = hovered != null ? px(hovered) : 0;
    const tipW = 128;
    const tipX = Math.min(Math.max(hoverX - tipW / 2, PAD_X - 10), W - PAD_X - tipW + 10);

    return (
        <div className="curve-chart">
            <div className="curve-chart-title"><span>{title}</span></div>
            <div className="chart-legend">
                {(zones || []).map((z, i) => {
                    const last = data[n - 1];
                    const v = last ? last['z' + i] : null;
                    return (
                        <span className="chart-legend-item" key={z.id || i}>
                            <span className="chart-legend-dot" style={{ background: ZONE_COLORS[i] }} />
                            {z.name}
                            {v != null && <b className="chart-legend-value">{formatNumber(v)}</b>}
                        </span>
                    );
                })}
            </div>

            <div className="curve-svg-wrap">
                <svg viewBox={`0 0 ${W} ${H}`} className="curve-svg" preserveAspectRatio="xMidYMid meet">
                    <defs>
                        <pattern id={`grid-${title}`} width="48" height="34" patternUnits="userSpaceOnUse">
                            <path d="M 48 0 L 0 0 0 34" fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth="1" />
                        </pattern>
                    </defs>
                    <rect width={W} height={H} fill={`url(#grid-${title})`} />

                    {/* 区域填充（上浮淡入） */}
                    {series.map(s => s.segs.length > 0 && (
                        <path
                            key={`area-${s.si}`}
                            d={smoothPath(s.segs[0]) + ` L ${s.segs[s.segs.length - 1][s.segs[s.segs.length - 1].length - 1].x},${H - PAD_BOTTOM} L ${s.segs[0][0].x},${H - PAD_BOTTOM} Z`}
                            fill={s.color}
                            fillOpacity="0.07"
                            style={{
                                opacity: phase >= 1 ? 1 : 0,
                                transform: phase >= 1 ? 'scale(1)' : 'scale(0.96)',
                                transformBox: 'fill-box',
                                transformOrigin: 'center bottom',
                                transition: 'opacity 0.8s ease-out, transform 1.4s ease-out',
                                transitionDelay: `${s.si * 180}ms`
                            }}
                        />
                    ))}

                    {/* 折线（分段绘制动画） */}
                    {series.map(s => s.segs.map((seg, si) => (
                        <path
                            key={`line-${s.si}-${si}`}
                            d={smoothPath(seg)}
                            fill="none"
                            stroke={s.color}
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            pathLength="1"
                            style={{
                                opacity: phase >= 2 ? 1 : 0,
                                strokeDasharray: 1,
                                strokeDashoffset: phase >= 2 ? 0 : 1,
                                transition: 'opacity 0.6s ease-out, stroke-dashoffset 1.6s ease-out',
                                transitionDelay: `${600 + s.si * 220}ms`
                            }}
                        />
                    )))}

                    {/* X 轴标签 */}
                    {data.map((d, i) => (
                        <text
                            key={`x-${i}`}
                            x={px(i)}
                            y={H - 18}
                            textAnchor="middle"
                            fill="#9ca3af"
                            fontSize="12"
                            style={{
                                opacity: phase >= 3 ? 1 : 0,
                                transition: 'opacity 0.5s ease-out',
                                transitionDelay: phase >= 3 ? `${1000 + i * 40}ms` : '0ms'
                            }}
                        >
                            {mode === 'today' ? fmtTime(d.time) : dayLabel(d.time)}
                        </text>
                    ))}

                    {/* 数据点（逐个弹出：缩放 + 淡入） */}
                    {series.map(s => data.map((d, i) => {
                        const v = d['z' + s.si];
                        if (v == null) return null;
                        return (
                            <g key={`dot-${s.si}-${i}`}>
                                {/* 隐形热区 */}
                                <circle
                                    cx={px(i)}
                                    cy={py(v)}
                                    r="14"
                                    fill="transparent"
                                    onMouseEnter={() => setHovered(i)}
                                    onMouseLeave={() => setHovered(null)}
                                />
                                <circle
                                    cx={px(i)}
                                    cy={py(v)}
                                    r={hovered === i ? 5.5 : 3}
                                    fill="#fff"
                                    stroke={s.color}
                                    strokeWidth="2.5"
                                    style={{
                                        opacity: phase >= 3 ? 1 : 0,
                                        transform: phase >= 3 ? 'scale(1)' : 'scale(0)',
                                        transformBox: 'fill-box',
                                        transformOrigin: 'center',
                                        transition: 'opacity 0.5s ease-out, transform 0.5s ease-out, r 0.25s ease',
                                        transitionDelay: phase >= 3 ? `${1200 + i * 60 + s.si * 80}ms` : '0ms'
                                    }}
                                />
                            </g>
                        );
                    }))}

                    {/* Hover 提示卡片 */}
                    {hovered != null && (
                        <g>
                            <rect
                                x={tipX}
                                y={8}
                                width={tipW}
                                height={34 + (zones || []).length * 18}
                                fill="#fff"
                                stroke="rgba(0,0,0,0.08)"
                                rx="8"
                                className="curve-tip-shadow"
                            />
                            <text x={tipX + tipW / 2} y={24} textAnchor="middle" fill="#1f2937" fontSize="12" fontWeight="600">
                                {mode === 'today' ? `今日 ${fmtTime(data[hovered].time)}` : `${dayLabel(data[hovered].time)} ${fmtTime(data[hovered].time)}`}
                            </text>
                            {(zones || []).map((z, si) => {
                                const v = data[hovered]['z' + si];
                                return v != null ? (
                                    <text
                                        key={`tip-${si}`}
                                        x={tipX + 12}
                                        y={42 + si * 18}
                                        fill={ZONE_COLORS[si]}
                                        fontSize="11"
                                        fontWeight="500"
                                    >
                                        {z.name}  {formatNumber(v)}
                                    </text>
                                ) : null;
                            })}
                        </g>
                    )}
                </svg>
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

    const localSamples = useMemo(() => getPlayerCurve(playerId, difficulty, currentWeek), [playerId, difficulty, currentWeek]);
    const samples = serverSamples && serverSamples.length > 0 ? serverSamples : localSamples;

    // 今日（按小时）
    const todayData = useMemo(() => {
        const now = new Date();
        const startT = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const endT = startT + 24 * 3600 * 1000;
        return samples
            .filter(s => s.t >= startT && s.t < endT)
            .map(s => ({ ...toRow(s), label: fmtTime(s.t) }))
            .sort((a, b) => a.time - b.time)
            .map((d, i) => ({ ...d, _i: i }));
    }, [samples]);

    // 本周（按天，每天取最后一条采样）
    const weekData = useMemo(() => {
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
            .sort((a, b) => a.time - b.time)
            .map((d, i) => ({ ...d, _i: i }));
    }, [samples]);

    const hasAny = data => data.some(d => d.z0 != null || d.z1 != null || d.z2 != null);
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
