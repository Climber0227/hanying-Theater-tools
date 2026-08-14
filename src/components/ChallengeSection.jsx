import React, { useEffect, useMemo, useState } from 'react';
import { getMondayStart, formatNumber, formatScoreCompact } from '../utils/format.js';

// ========== 挑战与分数（我的页） ==========
// 数据源：my_wz_today_samples 本周采样（每次同步记一个点）：
//   { t, total, zones: [s0,s1,s2], challengeTimes(总挑战次数), zoneTimes: [t0,t1,t2](各区次数) }
// 说明：库街区接口只返回当前快照（总次数/各区次数/分数），"挑战第 N 次时分数多少"的
//       关联只能靠同步积累：每次挑战后点「同步分数」，曲线就多一个点，形成阶梯突破曲线。
// 图 1：挑战次数 × 分数（总分 + 三区，突破点标注 +涨幅）
// 图 2：各区挑战次数堆叠柱（每根柱 = 两次同步之间新增的挑战次数）

const ZONE_COLORS = ['#0a84ff', '#ff9f0a', '#bf5af2'];
const TOTAL_COLOR = '#64748b';
const TODAY_SAMPLES_KEY = 'my_wz_today_samples';

// 本周采样（换周清空，按时间排序）
function readWeekSamples() {
    try {
        const raw = JSON.parse(localStorage.getItem(TODAY_SAMPLES_KEY)) || [];
        const monday = getMondayStart();
        return raw.filter(s => s.t >= monday && s.total > 0).sort((a, b) => a.t - b.t);
    } catch { return []; }
}

// 平滑贝塞尔路径（与 CurveChart 同款）
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

// 断点分段（缺失值拆成多段，避免跨缺口连线）
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

// ===== 图 1：挑战次数 × 分数 关联图 =====
function ChallengeScoreChart({ pts, zones }) {
    const [phase, setPhase] = useState(0);
    useEffect(() => {
        const t = setTimeout(() => setPhase(1), 60);
        return () => clearTimeout(t);
    }, []);

    const W = 800, H = 360, PAD_L = 64, PAD_R = 24, PAD_T = 34, PAD_B = 46;
    const plotW = W - PAD_L - PAD_R;
    const plotH = H - PAD_T - PAD_B;
    const maxTimes = Math.max(...pts.map(s => s.challengeTimes || 0), 1);
    const maxScore = Math.max(...pts.map(s => Math.max(s.total || 0, ...(s.zones || [0, 0, 0]))), 1);
    const x = ct => PAD_L + (ct / maxTimes) * plotW;
    const y = v => PAD_T + (1 - v / maxScore) * plotH;

    // 各区折线点（缺失断开）
    const zonePts = [0, 1, 2].map(zi => pts.map(s => {
        const v = (s.zones && s.zones[zi]) || 0;
        return v > 0 ? { x: x(s.challengeTimes), y: y(v), v, ct: s.challengeTimes } : null;
    }));
    // 总分线 + 突破标注
    const totalPts = pts.map(s => ({ x: x(s.challengeTimes), y: y(s.total || 0), v: s.total || 0, ct: s.challengeTimes }));
    const rises = [];
    for (let i = 1; i < pts.length; i++) {
        const cur = pts[i].total || 0;
        const prev = pts[i - 1].total || 0;
        if (cur > prev) rises.push({ i, ct: pts[i].challengeTimes, delta: cur - prev, x: x(pts[i].challengeTimes), y: y(cur) });
    }

    // Y 轴刻度（分数，万/亿 紧凑）
    const yTicks = [];
    for (let k = 0; k <= 4; k++) yTicks.push((maxScore / 4) * k);
    // X 轴刻度（挑战次数）
    const xTicks = [];
    for (let k = 0; k <= 4; k++) xTicks.push(Math.round((maxTimes / 4) * k));

    const last = pts[pts.length - 1];
    return (
        <div className="curve-chart">
            <div className="curve-chart-title"><span>挑战次数 × 分数（本周）</span></div>
            <div className="chart-legend">
                {(zones || []).map((z, i) => (
                    <span className="chart-legend-item" key={z.id || i}>
                        <span className="chart-legend-dot" style={{ background: ZONE_COLORS[i] }} />
                        {z.name}
                        {last && last.zones && last.zones[i] > 0 && <b className="chart-legend-value">{formatNumber(last.zones[i])}</b>}
                    </span>
                ))}
                <span className="chart-legend-item">
                    <span className="chart-legend-dot" style={{ background: TOTAL_COLOR }} />
                    总分
                    {last && <b className="chart-legend-value">{formatNumber(last.total)}</b>}
                </span>
            </div>
            <div className="curve-svg-wrap">
                <svg viewBox={`0 0 ${W} ${H}`} className="curve-svg" preserveAspectRatio="xMidYMid meet">
                    <defs>
                        <pattern id="chlgrid" width="48" height="34" patternUnits="userSpaceOnUse">
                            <path d="M 48 0 L 0 0 0 34" fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth="1" />
                        </pattern>
                    </defs>
                    <rect width={W} height={H} fill="url(#chlgrid)" />
                    {/* Y 轴刻度 */}
                    {yTicks.map((v, i) => (
                        <g key={`y${i}`}>
                            <line x1={PAD_L} y1={y(v)} x2={W - PAD_R} y2={y(v)} stroke="rgba(0,0,0,0.06)" strokeWidth="1" />
                            <text x={PAD_L - 8} y={y(v) + 4} textAnchor="end" fontSize="10" fill="#86868b">{formatScoreCompact(Math.round(v))}</text>
                        </g>
                    ))}
                    {/* X 轴刻度（挑战次数） */}
                    {xTicks.map((v, i) => (
                        <text key={`x${i}`} x={x(v)} y={H - PAD_B + 18} textAnchor="middle" fontSize="10" fill="#86868b">{formatNumber(v)}</text>
                    ))}
                    <text x={W / 2} y={H - 8} textAnchor="middle" fontSize="10" fill="#86868b">累计挑战次数</text>

                    {/* 各区折线（虚线分隔的实线，断点分段） */}
                    {zonePts.map((ptsArr, si) => splitPoints(ptsArr).map((seg, si2) => (
                        <path
                            key={`zl-${si}-${si2}`}
                            d={smoothPath(seg)}
                            fill="none"
                            stroke={ZONE_COLORS[si]}
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            pathLength="1"
                            style={{
                                opacity: phase ? 1 : 0,
                                strokeDasharray: 1,
                                strokeDashoffset: phase ? 0 : 1,
                                transition: `stroke-dashoffset 1.6s linear ${si * 200 + si2 * 120}ms, opacity 0.3s ease ${si * 200 + si2 * 120}ms`
                            }}
                        />
                    )))}
                    {/* 总分线（虚线） */}
                    {splitPoints(totalPts).map((seg, si) => (
                        <path
                            key={`tl-${si}`}
                            d={smoothPath(seg)}
                            fill="none"
                            stroke={TOTAL_COLOR}
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeDasharray="7 4"
                            pathLength="1"
                            style={{
                                opacity: phase ? 1 : 0,
                                strokeDashoffset: phase ? 0 : 1,
                                transition: `stroke-dashoffset 1.6s linear ${zonePts.length * 200 + si * 120}ms, opacity 0.3s ease ${zonePts.length * 200 + si * 120}ms`
                            }}
                        />
                    ))}

                    {/* 数据点 */}
                    {pts.map((s, i) => (
                        <circle
                            key={`p${i}`}
                            cx={x(s.challengeTimes)}
                            cy={y(s.total || 0)}
                            r="3.5"
                            fill="#fff"
                            stroke={TOTAL_COLOR}
                            strokeWidth="2"
                            style={{
                                opacity: phase ? 1 : 0,
                                transform: phase ? 'scale(1)' : 'scale(0)',
                                transformBox: 'fill-box',
                                transformOrigin: 'center',
                                transition: 'opacity 0.4s ease-out, transform 0.4s ease-out',
                                transitionDelay: `${1200 + i * 60}ms`
                            }}
                        >
                            <title>{`第 ${formatNumber(s.challengeTimes)} 次挑战后：总分 ${formatNumber(s.total)}，三区 ${(s.zones || []).map((v, zi) => `${(zones[zi] || { name: `区${zi + 1}` }).name} ${formatNumber(v)}`).join(' / ')}`}</title>
                        </circle>
                    ))}

                    {/* 突破标注：分数较上次同步上涨时，标出涨幅 */}
                    {rises.map((r, i) => (
                        <text
                            key={`r${i}`}
                            x={r.x}
                            y={Math.max(r.y - 10, 14)}
                            textAnchor="middle"
                            fontSize="10"
                            fontWeight="600"
                            fill={TOTAL_COLOR}
                            style={{
                                opacity: phase ? 1 : 0,
                                transition: 'opacity 0.4s ease',
                                transitionDelay: `${1500 + r.i * 60}ms`
                            }}
                        >
                            <title>{`第 ${formatNumber(r.ct)} 次挑战后总分上涨 ${formatNumber(r.delta)}`}</title>
                            +{formatScoreCompact(r.delta)}
                        </text>
                    ))}
                </svg>
            </div>
            <div className="score-note challenge-note">横轴 = 累计挑战次数，分数随每次同步更新；<b>+xxx</b> 标注为较上次同步的分数上涨（突破点）</div>
        </div>
    );
}

// ===== 图 2：各区挑战次数堆叠柱（每次同步间隔新增） =====
function ChallengeTimesChart({ pts, zones }) {
    const [phase, setPhase] = useState(0);
    useEffect(() => {
        const t = setTimeout(() => setPhase(1), 60);
        return () => clearTimeout(t);
    }, []);

    const W = 800, H = 360, PAD_L = 64, PAD_R = 24, PAD_T = 34, PAD_B = 46;
    const plotW = W - PAD_L - PAD_R;
    const plotH = H - PAD_T - PAD_B;

    // 每根柱 = 两次同步之间各区新增挑战次数（首柱 = 周初到首次同步）
    const bars = pts.map((s, i) => {
        const prev = i > 0 ? pts[i - 1] : null;
        return [0, 1, 2].map(zi => {
            const cur = (s.zoneTimes && s.zoneTimes[zi]) || 0;
            const base = prev ? (prev.zoneTimes && prev.zoneTimes[zi]) || 0 : 0;
            return Math.max(cur - base, 0);
        });
    });
    const maxTotal = Math.max(...bars.map(b => b.reduce((a, v) => a + v, 0)), 1);
    const y = v => PAD_T + (1 - v / maxTotal) * plotH;
    const n = bars.length;
    const slot = plotW / n;
    const barW = Math.min(slot * 0.6, 56);

    // Y 轴刻度（次数）
    const yTicks = [];
    for (let k = 0; k <= 4; k++) yTicks.push((maxTotal / 4) * k);

    const last = pts[pts.length - 1];
    return (
        <div className="curve-chart">
            <div className="curve-chart-title"><span>各区挑战次数（同步间隔）</span></div>
            <div className="chart-legend">
                {(zones || []).map((z, i) => (
                    <span className="chart-legend-item" key={z.id || i}>
                        <span className="chart-legend-dot" style={{ background: ZONE_COLORS[i] }} />
                        {z.name}
                        {last && last.zoneTimes && last.zoneTimes[i] > 0 && <b className="chart-legend-value">{formatNumber(last.zoneTimes[i])}次</b>}
                    </span>
                ))}
                <span className="chart-legend-item">
                    <span className="chart-legend-dot" style={{ background: TOTAL_COLOR }} />
                    总次数
                    {last && <b className="chart-legend-value">{formatNumber(last.challengeTimes || 0)}次</b>}
                </span>
            </div>
            <div className="curve-svg-wrap">
                <svg viewBox={`0 0 ${W} ${H}`} className="curve-svg" preserveAspectRatio="xMidYMid meet">
                    <defs>
                        <pattern id="chltgrid" width="48" height="34" patternUnits="userSpaceOnUse">
                            <path d="M 48 0 L 0 0 0 34" fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth="1" />
                        </pattern>
                    </defs>
                    <rect width={W} height={H} fill="url(#chltgrid)" />
                    {yTicks.map((v, i) => (
                        <g key={`y${i}`}>
                            <line x1={PAD_L} y1={y(v)} x2={W - PAD_R} y2={y(v)} stroke="rgba(0,0,0,0.06)" strokeWidth="1" />
                            <text x={PAD_L - 8} y={y(v) + 4} textAnchor="end" fontSize="10" fill="#86868b">{formatNumber(Math.round(v))}</text>
                        </g>
                    ))}
                    <text x={W / 2} y={H - 8} textAnchor="middle" fontSize="10" fill="#86868b">同步顺序（每次挑战后同步一次）</text>

                    {/* 堆叠柱（从底部生长动画） */}
                    {bars.map((bar, i) => {
                        let acc = 0;
                        return (
                            <g key={`b${i}`} style={{
                                opacity: phase ? 1 : 0,
                                transform: phase ? 'scale(1)' : 'scaleY(0)',
                                transformBox: 'fill-box',
                                transformOrigin: 'center bottom',
                                transition: 'opacity 0.4s ease, transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
                                transitionDelay: `${i * 70}ms`
                            }}>
                                {bar.map((v, zi) => {
                                    const x0 = PAD_L + i * slot + (slot - barW) / 2;
                                    const h = (v / maxTotal) * plotH;
                                    const y0 = y(acc + v);
                                    acc += v;
                                    if (v <= 0) return null;
                                    return (
                                        <rect
                                            key={`seg${zi}`}
                                            x={x0}
                                            y={y0}
                                            width={barW}
                                            height={h}
                                            fill={ZONE_COLORS[zi]}
                                            fillOpacity="0.82"
                                            rx="2"
                                        >
                                            <title>{`第 ${i + 1} 次同步后：${(zones[zi] || { name: `区${zi + 1}` }).name} +${v} 次（累计 ${formatNumber((pts[i].zoneTimes && pts[i].zoneTimes[zi]) || 0)} 次）`}</title>
                                        </rect>
                                    );
                                })}
                                <text x={PAD_L + i * slot + slot / 2} y={H - PAD_B + 18} textAnchor="middle" fontSize="10" fill="#86868b">{i + 1}</text>
                            </g>
                        );
                    })}
                </svg>
            </div>
            <div className="score-note challenge-note">每根柱 = 两次同步之间各区新增的挑战次数（首柱为周初到首次同步）；柱上数字为同步序号</div>
        </div>
    );
}

// ===== 区块容器 =====
export default function ChallengeSection({ zones, syncStamp }) {
    const samples = useMemo(readWeekSamples, [syncStamp]);
    const zoneList = zones && zones.length > 0 ? zones : [{ name: '区1' }, { name: '区2' }, { name: '区3' }];
    // 只有带挑战次数（新版采样）的点才能画关联图
    const pts = samples.filter(s => s.challengeTimes > 0);
    const hasData = pts.length >= 2;

    return (
        <div className="mine-section challenge-section">
            <div className="mine-section-header">
                <h3>挑战与分数</h3>
            </div>
            <div className="score-note">
                每次挑战后点击「同步分数」，自动记录 <b>挑战次数 → 分数</b> 的对应关系：横轴挑战次数、纵轴分数，
                能直观看到第几次挑战后分数突破、涨了多少（曲线随本周同步自动累积，换周清零）
            </div>
            {!hasData ? (
                <div className="score-empty">
                    暂无挑战数据 —— 同步本周分数后自动开始记录（需同步 2 次以上才能成图）
                </div>
            ) : (
                <div className="trend-grid">
                    <ChallengeScoreChart pts={pts} zones={zoneList} />
                    <ChallengeTimesChart pts={pts} zones={zoneList} />
                </div>
            )}
        </div>
    );
}
