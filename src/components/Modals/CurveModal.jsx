import React, { useEffect, useMemo, useState } from 'react';
import Modal from './Modal.jsx';
import { getPlayerCurve } from '../../api/storage.js';
import { formatNumber, fmtTime, getMondayStart } from '../../utils/format.js';

const WEEK_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const ZONE_COLORS = ['#0a84ff', '#ff9f0a', '#bf5af2'];
const TOTAL_COLOR = '#64748b';

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
    if (!s) return { time: 0, z0: null, z1: null, z2: null };
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

// 单张多区曲线图（SVG 自绘：平滑曲线 + 入场动画 + 常驻跟随 tooltip）
// showTotal=true 时额外渲染总分线（d.total），xLabelFn 可自定义 X 轴标签
// compact=true 为小尺寸版（并排时用）：更小 viewBox + 相对更粗线条，减少锯齿
export function CurveChart({ title, data, zones, mode, hasData, xLabelFn, showTotal, compact, startDelay = 0 }) {
    const [phase, setPhase] = useState(0); // 0 隐藏 → 1 区域 → 2 折线 → 3 数据点
    const [hover, setHover] = useState(null); // { i, x, y } 列索引 + 鼠标 viewBox 坐标

    const W = compact ? 420 : 800;
    const H = compact ? 280 : 440;
    const PAD_X = compact ? 36 : 60;
    const PAD_TOP = 4;
    const TOP_BAND = compact ? 36 : 56;           // 顶部总分条带
    const CHART_TOP = TOP_BAND + 8;               // 三区图表起点
    const PAD_BOTTOM = compact ? 34 : 52;
    const LINE_W = compact ? 3 : 2.5;
    const TOTAL_W = compact ? 3.5 : 3;
    const FONT_SIZE = compact ? 11 : 12;

    useEffect(() => {
        setPhase(0);
        setHover(null);
        const timers = [
            setTimeout(() => setPhase(1), startDelay + 100),
            setTimeout(() => setPhase(2), startDelay + 400),
            setTimeout(() => setPhase(3), startDelay + 800)
        ];
        return () => timers.forEach(clearTimeout);
    }, [data, startDelay]);

    const xLabel = d => {
        if (!d) return '';
        if (xLabelFn) return xLabelFn(d);
        return mode === 'today' ? fmtTime(d.time) : dayLabel(d.time);
    };

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
                    {showTotal && (
                        <span className="chart-legend-item">
                            <span className="chart-legend-dot" style={{ background: TOTAL_COLOR }} />
                            总分
                        </span>
                    )}
                </div>
                <div className="team-empty">暂无数据，数据会随榜单每 30 分钟自动刷新时记录</div>
            </div>
        );
    }

    const n = data.length;
    // 双刻度：三区共用自适应刻度（放大细微差异），总分独立刻度（顶部区域）
    const zoneValues = data.flatMap(d => [d.z0, d.z1, d.z2].filter(v => v != null));
    const zMin = zoneValues.length ? Math.min(...zoneValues) : 0;
    const zMax = zoneValues.length ? Math.max(...zoneValues) : 1;
    const zSpan = (zMax - zMin) || 1;
    const totalValues = showTotal ? data.map(d => d.total).filter(v => v != null && v > 0) : [];
    const tMax = totalValues.length ? Math.max(...totalValues) : 1;
    const px = i => PAD_X + (i / (n - 1)) * (W - PAD_X * 2);
    // 总分独立刻度：顶部条带（6 ~ TOP_BAND-8）；三区刻度：条带下方全高（CHART_TOP ~ H-PAD_BOTTOM）
    const pyTotal = v => 6 + (1 - v / tMax) * (TOP_BAND - 14);
    const pyZone = v => CHART_TOP + (1 - (v - zMin) / zSpan) * (H - CHART_TOP - PAD_BOTTOM);
    const chartW = W - PAD_X * 2;
    const chartH = H - CHART_TOP - PAD_BOTTOM;
    const gap = chartW / (n - 1);
    const tipW = 132;
    const tipH = 36 + ((zones || []).length + (showTotal ? 1 : 0)) * 18;

    const series = (zones || []).map((z, si) => ({
        z,
        si,
        color: ZONE_COLORS[si],
        segs: splitPoints(data.map(d => {
            const v = d['z' + si];
            return v != null ? { x: px(d._i), y: pyZone(v) } : null;
        }))
    }));

    const totalSeries = showTotal ? {
        color: TOTAL_COLOR,
        segs: splitPoints(data.map(d => {
            const v = d.total;
            return v != null && v > 0 ? { x: px(d._i), y: pyTotal(v) } : null;
        }))
    } : null;

    // 常驻跟随：鼠标在图上移动 → 吸附最近列 + 卡片贴鼠标
    const onMove = e => {
        const rect = e.currentTarget.getBoundingClientRect();
        const vx = ((e.clientX - rect.left) / rect.width) * W;
        const vy = ((e.clientY - rect.top) / rect.height) * H;
        const i = Math.round((vx - PAD_X) / gap);
        if (i >= 0 && i < n) setHover({ i, x: vx, y: vy });
        else setHover(null);
    };
    const onLeave = () => setHover(null);

    const hoverX = hover != null ? px(hover.i) : 0;
    // 卡片位置：默认鼠标右上（+14, -tipH-12），越界自动翻转
    let tipX = hover != null ? hover.x + 14 : 0;
    let tipY = hover != null ? hover.y - tipH - 12 : 0;
    if (hover != null) {
        if (tipX + tipW > W - 8) tipX = hover.x - tipW - 14;
        if (tipY < 8) tipY = hover.y + 14;
        tipX = Math.max(4, Math.min(tipX, W - tipW - 4));
        tipY = Math.max(4, tipY);
    }

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
                {totalSeries && (
                    <span className="chart-legend-item">
                        <span className="chart-legend-dot" style={{ background: TOTAL_COLOR }} />
                        总分
                        {data[n - 1].total != null && <b className="chart-legend-value">{formatNumber(data[n - 1].total)}</b>}
                    </span>
                )}
            </div>

            <div className="curve-svg-wrap">
                <svg
                    viewBox={`0 0 ${W} ${H}`}
                    className="curve-svg"
                    preserveAspectRatio="xMidYMid meet"
                    onMouseMove={onMove}
                    onMouseLeave={onLeave}
                >
                    <defs>
                        <pattern id={`grid-${title}`} width="48" height="34" patternUnits="userSpaceOnUse">
                            <path d="M 48 0 L 0 0 0 34" fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth="1" />
                        </pattern>
                    </defs>
                    <rect width={W} height={H} fill={`url(#grid-${title})`} />

                    {/* 总分条带分隔线 */}
                    {totalSeries && (
                        <line
                            x1={PAD_X}
                            y1={CHART_TOP - 4}
                            x2={W - PAD_X}
                            y2={CHART_TOP - 4}
                            stroke="rgba(0,0,0,0.12)"
                            strokeWidth="1"
                            strokeDasharray="2 3"
                        />
                    )}

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
                    {totalSeries && totalSeries.segs.map((seg, si) => (
                        <path
                            key={`tline-${si}`}
                            d={smoothPath(seg)}
                            fill="none"
                            stroke={totalSeries.color}
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeDasharray="7 4"
                            pathLength="1"
                            style={{
                                opacity: phase >= 2 ? 1 : 0,
                                strokeDashoffset: phase >= 2 ? 0 : 1,
                                transition: 'opacity 0.6s ease-out, stroke-dashoffset 1.6s ease-out',
                                transitionDelay: `${700 + series.length * 220}ms`
                            }}
                        />
                    ))}

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
                            {xLabel(d)}
                        </text>
                    ))}
                    {/* 数据点（逐个弹出：缩放 + 淡入） */}
                    {series.map(s => data.map((d, i) => {
                        const v = d['z' + s.si];
                        if (v == null) return null;
                        const active = hover != null && hover.i === i;
                        return (
                            <circle
                                key={`dot-${s.si}-${i}`}
                                cx={px(i)}
                                cy={pyZone(v)}
                                r={active ? 6 : 3}
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
                        );
                    }))}
                    {totalSeries && data.map((d, i) => {
                        const v = d.total;
                        if (v == null || v <= 0) return null;
                        const active = hover != null && hover.i === i;
                        return (
                            <circle
                                key={`tdot-${i}`}
                                cx={px(i)}
                                cy={pyTotal(v)}
                                r={active ? 6 : 3.5}
                                fill="#fff"
                                stroke={totalSeries.color}
                                strokeWidth="2.5"
                                style={{
                                    opacity: phase >= 3 ? 1 : 0,
                                    transform: phase >= 3 ? 'scale(1)' : 'scale(0)',
                                    transformBox: 'fill-box',
                                    transformOrigin: 'center',
                                    transition: 'opacity 0.5s ease-out, transform 0.5s ease-out, r 0.25s ease',
                                    transitionDelay: phase >= 3 ? `${1300 + i * 60}ms` : '0ms'
                                }}
                            />
                        );
                    })}

                    {/* 常驻跟随卡片 */}
                    {hover != null && (() => {
                        // 安全索引：数据源切换瞬间 hover 可能越界，防御性裁剪
                        const hi = hover.i >= 0 && hover.i < data.length ? hover.i : -1;
                        if (hi < 0) return null;
                        const hd = data[hi];
                        return (
                            <g>
                                <line
                                    x1={hoverX}
                                    y1={CHART_TOP}
                                    x2={hoverX}
                                    y2={H - PAD_BOTTOM}
                                    stroke="rgba(0,0,0,0.14)"
                                    strokeWidth="1"
                                    strokeDasharray="3 3"
                                />
                                <rect
                                    x={tipX}
                                    y={tipY}
                                    width={tipW}
                                    height={tipH}
                                    fill="#fff"
                                    stroke="rgba(0,0,0,0.08)"
                                    rx="8"
                                    className="curve-tip-shadow"
                                />
                                <text x={tipX + tipW / 2} y={tipY + 16} textAnchor="middle" fill="#1f2937" fontSize="12" fontWeight="600">
                                    {xLabel(hd)}
                                </text>
                                {(zones || []).map((z, si) => {
                                    const v = hd['z' + si];
                                    return v != null ? (
                                        <text
                                            key={`tip-${si}`}
                                            x={tipX + 12}
                                            y={tipY + 34 + si * 18}
                                            fill={ZONE_COLORS[si]}
                                        fontSize="11"
                                        fontWeight="500"
                                    >
                                        {z.name}  {formatNumber(v)}
                                    </text>
                                ) : null;
                            })}
                            {totalSeries && hd.total != null && (
                                <text
                                    x={tipX + 12}
                                    y={tipY + 34 + (zones || []).length * 18}
                                    fill={TOTAL_COLOR}
                                    fontSize="11"
                                    fontWeight="700"
                                >
                                    总分  {formatNumber(hd.total)}
                                </text>
                            )}
                            </g>
                        );
                    })()}
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
    // 数据源合并：服务端优先、本地补充（避免服务端采样不全时覆盖本地更完整的历史）
    const samples = useMemo(() => {
        const seen = new Set();
        const list = [];
        for (const s of [...(serverSamples || []), ...localSamples]) {
            if (!s || s.t == null) continue;
            if (seen.has(s.t)) continue;
            seen.add(s.t);
            list.push(s);
        }
        list.sort((a, b) => a.t - b.t);
        return list;
    }, [serverSamples, localSamples]);

    // 今日（按小时）
    const todayData = useMemo(() => {
        const now = new Date();
        const startT = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const endT = startT + 24 * 3600 * 1000;
        return samples
            .filter(s => s && s.t >= startT && s.t < endT)
            .map(s => ({ ...toRow(s), label: fmtTime(s.t) }))
            .sort((a, b) => a.time - b.time)
            .map((d, i) => ({ ...d, _i: i }));
    }, [samples]);

    // 本周（按天，每天取最后一条采样）
    const weekData = useMemo(() => {
        const startT = getMondayStart(new Date());
        const byDay = {};
        samples
            .filter(s => s && s.t >= startT)
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
