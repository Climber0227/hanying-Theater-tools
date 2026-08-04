import React, { useMemo, useState } from 'react';
import Modal from './Modal.jsx';
import { computeBrackets } from '../../utils/modalData.js';
import { formatNumber } from '../../utils/format.js';

// 分数分布：总分 + 各区（CSS 条形直方图）
export default function BracketModal({ rankings, zones, difficulty, onClose }) {
    const [key, setKey] = useState('total');

    const data = useMemo(() => computeBrackets(rankings, zones, key), [rankings, zones, key]);
    const title = key === 'total' ? '总分' : (zones[parseInt(key)]?.name || '');

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
                    <div className="bracket-list">
                        {data.buckets.map((b, i) => (
                            <div className="bracket-row" key={i}>
                                <div className="bracket-label">{formatNumber(b.from)} - {formatNumber(b.to)}</div>
                                <div className="bracket-bar-wrap">
                                    <div className="bracket-bar" style={{ width: `${Math.max(Math.round((b.count / data.maxCount) * 100), 3)}%` }} />
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
