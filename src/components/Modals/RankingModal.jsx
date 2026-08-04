import React, { useMemo, useState } from 'react';
import Modal from './Modal.jsx';
import { computeRankingGroups } from '../../utils/modalData.js';
import { getImageUrl } from '../../api/config.js';
import { formatNumber, formatScoreCompact, getQualityInfo, getTeamRankLabel } from '../../utils/format.js';

function RankPlayer({ p, pos, onOpenPlayer }) {
    const posClass = pos === 0 ? ' team-rank-pos-top1' : pos === 1 ? ' team-rank-pos-top2' : pos === 2 ? ' team-rank-pos-top3' : '';
    return (
        <div className="team-rank-item" onClick={() => onOpenPlayer && onOpenPlayer(p.id)}>
            <span className={`team-rank-pos${posClass}`}>{pos + 1}</span>
            {p.portrait && <img className="team-rank-avatar" src={getImageUrl(p.portrait)} alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />}
            <div className="team-rank-info">
                <span className="team-rank-name">{p.name}</span>
                <div className="team-rank-chars">
                    {(p.chars || []).map((c, i) => (
                        <span className="team-rank-char" key={i}>
                            {c.icon && <img className="team-rank-char-icon" src={getImageUrl(c.icon)} alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                            <span className="team-rank-char-name">{c.characterName}</span>
                            <span className="team-rank-bp">{c.bp ? formatScoreCompact(c.bp) : '--'}</span>
                        </span>
                    ))}
                </div>
            </div>
            <span className="team-rank-score">{formatNumber(p.score)}</span>
        </div>
    );
}

// 阵容排行：每区所有阵容折叠展示 + 角色搜索
export default function RankingModal({ rankings, zones, onClose, onOpenPlayer }) {
    const [zoneIdx, setZoneIdx] = useState(0);
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState({});
    const zone = (zones || [])[zoneIdx];

    const teams = useMemo(
        () => zone ? computeRankingGroups(rankings, zone.id, query.trim().toLowerCase()) : [],
        [rankings, zone, query]
    );

    return (
        <Modal title="阵容排行" sub="当前段位 · 各阵容独立排名" onClose={onClose} wide>
            <input
                type="text"
                className="ranking-search ranking-search-full"
                placeholder="搜索阵容角色名"
                value={query}
                onChange={e => setQuery(e.target.value)}
            />
            <div className="team-tabs team-zone-tabs">
                {(zones || []).map((z, i) => (
                    <button key={z.id || i} className={`team-tab${i === zoneIdx ? ' active' : ''}`} onClick={() => setZoneIdx(i)}>
                        {z.name}
                    </button>
                ))}
            </div>

            {!zone ? (
                <div className="team-empty">暂无数据</div>
            ) : teams.length === 0 ? (
                <div className="team-empty">暂无数据</div>
            ) : (
                <div className="team-zone-block">
                    <div className="team-zone-title">{zone.name} · 共 {teams.length} 套阵容</div>
                    {teams.map((t, idx) => {
                        const rankLabel = getTeamRankLabel(t.chars);
                        const isOpen = !!open[idx];
                        return (
                            <div className="team-rank-card" key={idx}>
                                <div
                                    className="team-rank-card-header"
                                    onClick={() => setOpen(o => ({ ...o, [idx]: !o[idx] }))}
                                >
                                    <span className="team-rank-toggle">{isOpen ? '▾' : '▸'}</span>
                                    <div className="team-rank-chars-sm">
                                        {t.chars.map((c, i) => (
                                            <div className="team-rank-char-sm" key={i}>
                                                {c.icon && <img src={getImageUrl(c.icon)} alt="" title={c.characterName} onError={e => { e.currentTarget.style.display = 'none'; }} />}
                                                <em className={`rank-quality-sm quality-${c.rank}`}>{getQualityInfo(c.rank)}</em>
                                            </div>
                                        ))}
                                    </div>
                                    <span className="team-rank-label">{rankLabel || '阶级未知'}</span>
                                    <span className="team-rank-count">{t.players.length}人</span>
                                    <span className="team-rank-max">最高 {formatNumber(t.players[0].score)}</span>
                                </div>
                                {isOpen && (
                                    <div className="team-rank-body">
                                        {t.players.map((p, i) => <RankPlayer key={p.id} p={p} pos={i} onOpenPlayer={onOpenPlayer} />)}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </Modal>
    );
}
