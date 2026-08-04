import React from 'react';
import Modal from './Modal.jsx';
import { computeZoneAnalysisData } from '../../utils/modalData.js';
import { getImageUrl } from '../../api/config.js';
import { formatNumber, formatScoreCompact, getQualityInfo } from '../../utils/format.js';

function SaChar({ c }) {
    return (
        <div className="sa-char">
            {c.icon && <img src={getImageUrl(c.icon)} alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />}
            <span>{c.characterName}</span>
            {getQualityInfo(c.rank) && <em className={`rank-quality-sm quality-${c.rank}`}>{getQualityInfo(c.rank)}</em>}
            {c.bp ? <span className="sa-char-bp">战力 {formatNumber(c.bp)}</span> : null}
        </div>
    );
}

// 单区分数分析：玩家该区分数 vs 同阵容最高分
export default function SaModal({ ranking, zoneIndex, rankings, zones, onClose }) {
    const data = computeZoneAnalysisData(ranking, zoneIndex, rankings, zones);
    if (!data) return null;
    const { zone, zoneData, zscore, maxInfo } = data;
    const monsterTag = (() => {
        const d = zone.description || '';
        if (d.includes('单体')) return '单怪';
        if (d.includes('双体')) return '双怪';
        if (d.includes('群体')) return '群怪';
        return '';
    })();

    return (
        <Modal onClose={onClose}>
            <div className="sa-header">
                <div className="sa-player-name">
                    {ranking.player.name}
                    <span className="sa-zone-label">{zone.name}{monsterTag && <span className="zone-tag">{monsterTag}</span>}</span>
                </div>
                <div className="sa-player-meta">
                    ID: {ranking.player.id} · 排名第{ranking.rank} · 总分 {formatNumber(ranking.score)}
                </div>
            </div>

            {!zoneData || !zoneData.characters || zoneData.characters.length === 0 ? (
                <div className="sa-empty">该玩家此区无上榜数据</div>
            ) : (
                <>
                    <div className="sa-zone">
                        <div className="sa-zone-title">我的分数 <span className="sa-zone-score">{formatNumber(zscore)}分</span></div>
                        <div className="sa-team">
                            {zoneData.characters.map((c, i) => <SaChar key={i} c={c} />)}
                        </div>
                    </div>

                    {maxInfo ? (
                        <div className="sa-zone">
                            <div className="sa-zone-title">同阶级阵容最高分 <span className="sa-zone-score">{formatNumber(maxInfo.score)}分</span></div>
                            <div className="sa-max-player">
                                <div className="sa-max-avatar">
                                    {maxInfo.player.portrait && <img src={getImageUrl(maxInfo.player.portrait)} alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                                </div>
                                <div className="sa-max-info">
                                    <div className="sa-max-name">{maxInfo.player.name}</div>
                                    <div className="sa-max-id">ID: {maxInfo.player.id}</div>
                                </div>
                            </div>
                            {maxInfo.chars.length > 0 && (
                                <div className="sa-team">
                                    {maxInfo.chars.map((c, i) => <SaChar key={i} c={c} />)}
                                </div>
                            )}
                            <div className="sa-zone-compare">
                                {maxInfo.isTop
                                    ? <span className="zone-max-tag">您是该阵容最高分</span>
                                    : <span className="zone-diff-tag">低于最高分 {formatScoreCompact(maxInfo.diff)}</span>}
                            </div>
                        </div>
                    ) : (
                        <div className="sa-empty">暂无同阵容其他玩家数据</div>
                    )}
                </>
            )}
        </Modal>
    );
}
