import React, { useMemo, useState } from 'react';
import Modal from './Modal.jsx';
import { computeBrackets } from '../../utils/modalData.js';
import { formatNumber, formatScoreCompact } from '../../utils/format.js';

// 分数分布：总分 + 各区。
// 用轻量条形列表代替 Recharts（原来这个弹窗要单独拉 358KB 图表库，
// 中端手机上打开时会有 ~200ms 长任务；现在这段代码不到 3KB）。
export default function BracketModal({ rankings, zones, difficulty, onClose }) {
    const [key, setKey] = useState('total');

    const data = useMemo(() => computeBrackets(rankings, zones, key), [rankings, zones, key]);
    const title = key === 'total' ? '总分' : (zones[parseInt(key)]?.name || '');

    const rows = (data && data.buckets) || [];
    const maxCount = Math.max(1, ...rows.map(b => b.count));
    const peak = useMemo(() => {
        if (!rows.length) return null;
        return rows.reduce((a, b) => (b.count > a.count ? b : a), rows[0]);
    }, [rows]);

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

            {rows.length > 0 ? (
                <>
                    <div className="bracket-title">
                        {title}分布（{formatNumber(data.total)} 人）
                        {peak && (
                            <span className="bracket-peak-note">
                                最多 {formatScoreCompact(peak.from)}–{formatScoreCompact(peak.to)} · {peak.count} 人
                            </span>
                        )}
                    </div>
                    <div className="bracket-list">
                        {rows.map(b => (
                            <div className={`bracket-row${peak && b.from === peak.from ? ' is-peak' : ''}`} key={b.from}>
                                <div className="bracket-label">
                                    {formatScoreCompact(b.from)}<span className="bracket-dash">–</span>{formatScoreCompact(b.to)}
                                </div>
                                <div className="bracket-bar-wrap">
                                    <div className="bracket-bar" style={{ width: `${Math.max(2, (b.count / maxCount) * 100)}%` }} />
                                </div>
                                <div className="bracket-count">{b.count}</div>
                            </div>
                        ))}
                    </div>
                </>
            ) : (
                <div className="bracket-empty">暂无数据</div>
            )}
        </Modal>
    );
}
