import React, { useState } from 'react';
import Modal from './Modal.jsx';
import { getImageUrl } from '../../api/config.js';
import { formatNumber, formatScoreCompact, getQualityInfo } from '../../utils/format.js';
import { getRankDelta } from '../../utils/ranking.js';
import { TeamCompareTag } from '../Ranking/RankingRow.jsx';

// 手机端排行榜行二级弹窗：玩家头 + 三区 tab（复用 TeamCompareTag / SaModal 单区结构）
export default function PlayerRankModal({ ranking, zones, prevSnapshot, teamMax, onClose, onOpenPlayer, onOpenAnalysis, onOpenTrend }) {
    const [activeZone, setActiveZone] = useState(0);
    const r = ranking;
    const zone = zones[activeZone];
    const zd = r.zones ? r.zones.find(z => z.id === zone.id) : null;
    const delta = getRankDelta(r.player.id, r.rank, r.score, prevSnapshot);
    const portraitUrl = r.player.portrait ? getImageUrl(r.player.portrait) : '';
    const frameUrl = r.player.frame ? getImageUrl(r.player.frame) : '';

    return (
        <Modal title={r.player.name} sub={`ID: ${r.player.id} · 排名第${r.rank}`} onClose={onClose}>
            <div className="prm-header">
                <div className="player-avatar-sm prm-avatar">
                    {portraitUrl && <img src={portraitUrl} alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                    {frameUrl && <img src={frameUrl} alt="" className="frame-sm" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                </div>
                <div className="prm-total">
                    <span className="prm-total-label">总分</span>
                    <span className="prm-total-val">{formatNumber(r.score)}</span>
                    {delta && (() => {
                        if (delta.scoreDelta > 0) return <span className="score-delta-up">+{formatScoreCompact(delta.scoreDelta)}</span>;
                        if (delta.scoreDelta < 0) return <span className="score-delta-down">-{formatScoreCompact(Math.abs(delta.scoreDelta))}</span>;
                        return <span className="score-delta-same">0</span>;
                    })()}
                </div>
            </div>

            <div className="prm-tabs">
                {zones.map((z, i) => (
                    <button
                        key={z.id}
                        className={`prm-tab${i === activeZone ? ' active' : ''}`}
                        onClick={() => setActiveZone(i)}
                    >
                        {z.name}
                    </button>
                ))}
            </div>

            {!zd || !zd.characters || zd.characters.length === 0 ? (
                <div className="sa-empty">该玩家此区无上榜数据</div>
            ) : (
                <div className="prm-zone">
                    <div className="sa-zone-title">
                        第{activeZone + 1}区分数 <span className="sa-zone-score">{formatNumber(zd.score)}分</span>
                    </div>
                    <div className="prm-chars">
                        {zd.characters.map((c, i) => (
                            <div className="sa-char" key={i}>
                                {c.icon && <img src={getImageUrl(c.icon)} alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                                <span>{c.characterName}</span>
                                {getQualityInfo(c.rank) && <em className={`rank-quality-sm quality-${c.rank}`}>{getQualityInfo(c.rank)}</em>}
                                {c.cubIcon && <img className="cub-icon-sm" src={getImageUrl(c.cubIcon)} alt="" title={c.cubName || ''} onError={e => { e.currentTarget.style.display = 'none'; }} />}
                            </div>
                        ))}
                    </div>
                    <div className="prm-compare"><TeamCompareTag zd={zd} teamMax={teamMax} zone={zone} /></div>
                    <div className="prm-actions">
                        <button className="zone-sa-btn" onClick={() => onOpenAnalysis(r.player.id, activeZone)}>分析</button>
                        <button className="zone-sa-btn zone-trend-btn" onClick={() => onOpenTrend(r.player.id, activeZone)}>趋势</button>
                    </div>
                </div>
            )}

            <button className="prm-goto" onClick={() => { onClose(); onOpenPlayer(r.player.id); }}>前往玩家页</button>
        </Modal>
    );
}
