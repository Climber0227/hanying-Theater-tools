import React, { useState, useEffect } from 'react';
import { loadPpc } from '../api/client.js';
import { getImageUrl } from '../api/config.js';
import { formatNumber, formatTime } from '../utils/format.js';
import Modal from './Modals/Modal.jsx';

const LEVELS = [
    { value: '4', label: '终极区' },
    { value: '3', label: '高级区' }
];

function BossDetail({ boss, onClose }) {
    return (
        <Modal onClose={onClose}>
            <div className="boss-detail-header">
                <div className="boss-detail-name">
                    {boss.icon && <img className="boss-detail-icon" src={getImageUrl(boss.icon)} alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                    {boss.name}
                </div>
                <div className="zone-detail-desc">{boss.description}</div>
            </div>
            {(boss.stages || []).map((s, i) => (
                <div className="boss-stage" key={i}>
                    <div className="boss-stage-header">
                        <span className="boss-stage-difficulty">{s.difficulty}</span>
                        {s.score != null && <span className="boss-stage-score">{formatNumber(s.score)}</span>}
                    </div>
                    {s.buffs && s.buffs.length > 0 && (
                        <div className="boss-stage-section">
                            <div className="boss-section-title">增益</div>
                            {s.buffs.map((b, bi) => (
                                <div className="boss-buff" key={bi}>
                                    <div className="boss-buff-name">{b.name}</div>
                                    <div className="boss-buff-desc">{b.description}</div>
                                </div>
                            ))}
                        </div>
                    )}
                    {s.skills && s.skills.length > 0 && (
                        <div className="boss-stage-section">
                            <div className="boss-section-title">技能</div>
                            {s.skills.map((sk, si) => (
                                <div className="boss-skill" key={si}>
                                    <div className="boss-skill-name">{sk.name}</div>
                                    <div className="boss-skill-desc">{sk.description}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </Modal>
    );
}

// 幻痛囚笼页
export default function PpcPage({ onOpenPlayer }) {
    const [level, setLevel] = useState(localStorage.getItem('currentPpcLevel') || '4');
    const [week, setWeek] = useState(null);
    const [ppc, setPpc] = useState(null);
    const [ranking, setRanking] = useState([]);
    const [weekOptions, setWeekOptions] = useState({ min: null, max: null });
    const [sortAsc, setSortAsc] = useState(false);
    const [detailBoss, setDetailBoss] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const data = await loadPpc(week, level);
                if (cancelled) return;
                if (data.activities) setWeekOptions({ min: data.activities.min, max: data.activities.max });
                setPpc(data.ppc);
                if (data.ranking) setRanking(data.ranking || []);
            } catch { /* 忽略 */ } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [level, week]);

    const sorted = [...(ranking || [])].sort((a, b) => (sortAsc ? a.score - b.score : b.score - a.score)).slice(0, 100);
    const weeks = [];
    if (weekOptions.min != null) {
        for (let w = weekOptions.max; w >= weekOptions.min; w--) weeks.push(w);
    }

    return (
        <div>
            <header className="header">
                <h1>幻痛囚笼</h1>
                <div className="controls">
                    <select value={level} onChange={e => { setLevel(e.target.value); localStorage.setItem('currentPpcLevel', e.target.value); }}>
                        {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                    </select>
                    <select
                        className="week-select"
                        value={week == null ? '' : String(week)}
                        onChange={e => setWeek(e.target.value === '' ? null : parseInt(e.target.value))}
                    >
                        <option value="">本周</option>
                        {weeks.map(w => <option key={w} value={w}>第{w}周</option>)}
                    </select>
                    <span className="date-range">{ppc ? `${ppc.start} ~ ${ppc.end}` : ''}</span>
                    <span className="ranking-meta">{ppc ? `分区: ${ppc.level.name}` : ''}</span>
                    <span className="ranking-meta">{ppc ? `更新时间: ${formatTime(ppc.updatedAt)}` : ''}</span>
                </div>
            </header>

            <section className="ppc-bosses">
                {(ppc && ppc.bosses ? ppc.bosses : []).map((b, i) => (
                    <div className="ppc-boss-card" key={i} onClick={() => setDetailBoss(b)}>
                        {b.icon && <img src={getImageUrl(b.icon)} alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                        <span>{b.name}</span>
                    </div>
                ))}
            </section>

            <div className="rankings">
                <h2>
                    排行榜 <span className="top-label">TOP 100</span>
                    {loading && <span className="top-label">加载中…</span>}
                </h2>
                <div className="ranking-table ppc-ranking">
                    <div className="ranking-header">
                        <div className="col-rank">排名</div>
                        <div className="col-player">玩家</div>
                        <div className="col-total sortable" onClick={() => setSortAsc(a => !a)}>
                            总分<span className="sort-arrow">{sortAsc ? ' ▲' : ' ▼'}</span>
                        </div>
                    </div>
                    {sorted.map((r, i) => {
                        const top = i < 3;
                        return (
                            <div className="ranking-row" key={r.player.id} style={{ padding: '10px 24px' }}>
                                <div className={`rank-num${top ? ` top-${i + 1}` : ''}`} style={{ width: 80 }}>
                                    {top && <span className={`rank-medal medal-${i + 1}`}>{i + 1}</span>}
                                    {!top && i + 1}
                                </div>
                                <div className="player-info ranking-player" onClick={() => onOpenPlayer(r.player.id)} style={{ width: 220 }}>
                                    <div className="player-avatar-sm">
                                        {r.player.portrait && <img src={getImageUrl(r.player.portrait)} alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                                    </div>
                                    <div className="player-text">
                                        <div className="player-name">{r.player.name}</div>
                                        <div className="player-id-text">ID: {r.player.id}</div>
                                        {r.player.guildName && <div className="guild-name">{r.player.guildName}</div>}
                                    </div>
                                </div>
                                <div className="total-score">{formatNumber(r.score)}</div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {detailBoss && <BossDetail boss={detailBoss} onClose={() => setDetailBoss(null)} />}
        </div>
    );
}
