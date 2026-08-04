import React, { useMemo, useState } from 'react';
import Modal from './Modal.jsx';
import { computeStrongTeams, computeCommonTeams } from '../../utils/modalData.js';
import { getImageUrl } from '../../api/config.js';
import { formatNumber, getQualityInfo } from '../../utils/format.js';

function TeamChars({ chars, showQuality }) {
    return (
        <div className="team-chars">
            {chars.map((c, i) => (
                <div className="team-char" key={i}>
                    {c.icon && <img src={getImageUrl(c.icon)} alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                    <span>{c.characterName}</span>
                    {showQuality && getQualityInfo(c.rank) && <em className={`rank-quality-sm quality-${c.rank}`}>{getQualityInfo(c.rank)}</em>}
                </div>
            ))}
        </div>
    );
}

// 阵容参考：最强 / 最常用
export default function TeamModal({ rankings, zones, onClose }) {
    const [zoneIdx, setZoneIdx] = useState(0);
    const [mode, setMode] = useState('strong');
    const zone = (zones || [])[zoneIdx];

    const strongTeams = useMemo(() => zone ? computeStrongTeams(rankings, zone.id) : [], [rankings, zone]);
    const commonTeams = useMemo(() => zone ? computeCommonTeams(rankings, zone.id) : [], [rankings, zone]);

    return (
        <Modal title="阵容参考" onClose={onClose} wide>
            <div className="team-tabs">
                <button className={`team-tab${mode === 'strong' ? ' active' : ''}`} onClick={() => setMode('strong')}>最强阵容</button>
                <button className={`team-tab${mode === 'common' ? ' active' : ''}`} onClick={() => setMode('common')}>最常用阵容</button>
            </div>
            <div className="team-tabs team-zone-tabs">
                {(zones || []).map((z, i) => (
                    <button key={z.id || i} className={`team-tab${i === zoneIdx ? ' active' : ''}`} onClick={() => setZoneIdx(i)}>
                        {z.name}
                    </button>
                ))}
            </div>

            {!zone ? (
                <div className="team-empty">暂无数据</div>
            ) : mode === 'strong' ? (
                <div className="team-zone-block">
                    <div className="team-zone-title">{zone.name}</div>
                    {strongTeams.length === 0 ? (
                        <div className="team-empty">暂无数据</div>
                    ) : strongTeams.map((t, i) => (
                        <div className="team-card" key={i}>
                            <div className="team-rank-badge">NO.{i + 1}</div>
                            <TeamChars chars={t.chars} showQuality />
                            <div className="team-meta">
                                <span className="team-score">{formatNumber(t.score)}分</span>
                                <span className="team-player">{t.playerName}</span>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="team-zone-block">
                    <div className="team-zone-title">{zone.name}</div>
                    {commonTeams.length === 0 ? (
                        <div className="team-empty">暂无数据</div>
                    ) : commonTeams.map((t, i) => (
                        <div className="team-card team-card-common" key={i}>
                            <div className="team-usage-bar"><div className="team-usage-fill" style={{ width: `${t.barWidth}%` }} /></div>
                            <TeamChars chars={t.chars} showQuality={false} />
                            <div className="team-meta">
                                <span className="team-usage-pct">{t.pct.toFixed(1)}%</span>
                                <span className="team-count">{t.count}人</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </Modal>
    );
}
