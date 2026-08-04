import React, { memo } from 'react';
import { getImageUrl } from '../../api/config.js';
import { formatNumber, formatScoreCompact, getQualityInfo, getTeamKey } from '../../utils/format.js';
import { getRankDelta } from '../../utils/ranking.js';

export const ROW_HEIGHT = 152;

function RankDelta({ delta }) {
    if (!delta) return null;
    if (delta.rankDelta > 0) return <span className="rank-delta-up">↑{delta.rankDelta}</span>;
    if (delta.rankDelta < 0) return <span className="rank-delta-down">↓{Math.abs(delta.rankDelta)}</span>;
    return <span className="rank-delta-same">—</span>;
}

function ScoreDelta({ delta }) {
    if (!delta) return null;
    if (delta.scoreDelta > 0) return <span className="score-delta-up">+{formatScoreCompact(delta.scoreDelta)}</span>;
    if (delta.scoreDelta < 0) return <span className="score-delta-down">-{formatScoreCompact(Math.abs(delta.scoreDelta))}</span>;
    return <span className="score-delta-same">0</span>;
}

function ZoneScoreDelta({ diff }) {
    if (diff == null) return null;
    if (diff > 0) return <span className="score-delta-up">+{formatScoreCompact(diff)}</span>;
    if (diff < 0) return <span className="score-delta-down">-{formatScoreCompact(Math.abs(diff))}</span>;
    return <span className="score-delta-same">0</span>;
}

function TeamCompareTag({ zd, teamMax, zone }) {
    if (!zd || !zd.characters || zd.characters.length === 0) return null;
    const key = getTeamKey(zd.characters);
    const max = teamMax[zone.id] && teamMax[zone.id][key];
    if (!max) return null;
    const zscore = zd.score || 0;
    if (zscore <= 0) return null;
    const diff = max.score - zscore;
    return diff <= 0
        ? <span className="zone-max-tag">同阶级阵容最高 {formatNumber(max.score)}</span>
        : <span className="zone-diff-tag">同阶级阵容最高 {formatNumber(max.score)} · 低{formatScoreCompact(diff)}</span>;
}

function CharList({ chars }) {
    return (chars || []).map((c, i) => (
        <div className="char-row" key={i}>
            {c.icon && <img className="char-icon-sm" src={getImageUrl(c.icon)} alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />}
            <span className="char-name-sm">{c.characterName}</span>
            {getQualityInfo(c.rank) && <span className={`rank-quality-sm quality-${c.rank}`}>{getQualityInfo(c.rank)}</span>}
            <span className="char-bp">{c.bp}</span>
            {c.cubIcon && <img className="cub-icon-sm" src={getImageUrl(c.cubIcon)} alt="" title={c.cubName || ''} onError={e => { e.currentTarget.style.display = 'none'; }} />}
        </div>
    ));
}

function ZoneCell({ zone, zd, delta, teamMax, onAnalysis, onTrend }) {
    return (
        <div className="zone-detail">
            <div className="zone-actions">
                <button className="zone-sa-btn" onClick={e => { e.stopPropagation(); onAnalysis(); }}>分析</button>
                <button className="zone-sa-btn zone-trend-btn" onClick={e => { e.stopPropagation(); onTrend(); }}>趋势</button>
            </div>
            <div className="zone-name-sm">{zone.name}</div>
            <div className="zone-score-val">
                {zd ? formatNumber(zd.score) : '--'}
                {delta && zd && Object.prototype.hasOwnProperty.call(delta.zoneScores, zone.id) && (
                    <ZoneScoreDelta diff={(zd.score || 0) - (delta.zoneScores[zone.id] || 0)} />
                )}
            </div>
            <div className="zone-team-compare"><TeamCompareTag zd={zd} teamMax={teamMax} zone={zone} /></div>
            <div className="zone-chars"><CharList chars={zd && zd.characters} /></div>
        </div>
    );
}

const MEDALS = { 1: '冠军', 2: '亚军', 3: '季军' };

function RankingRowBase({ index, style, rows, zones, teamMax, totalMaxScore, prevSnapshot, onOpenPlayer, onOpenAnalysis, onOpenTrend }) {
    const r = rows[index];
    const displayRank = index + 1;
    const topN = displayRank <= 3;
    const portraitUrl = r.player.portrait ? getImageUrl(r.player.portrait) : '';
    const frameUrl = r.player.frame ? getImageUrl(r.player.frame) : '';
    const delta = getRankDelta(r.player.id, r.rank, r.score, prevSnapshot);

    return (
        <div className={`ranking-row${topN ? ` top-${displayRank}-row` : ''}`} style={style}>
            <div className={`rank-num${topN ? ` top-${displayRank}` : ''}`}>
                {topN && <><span className={`rank-medal medal-${displayRank}`}>{displayRank}</span><span className="rank-medal-label">{MEDALS[displayRank]}</span></>}
                {!topN && displayRank}
                <RankDelta delta={delta} />
            </div>

            <div className="player-info ranking-player" onClick={() => onOpenPlayer(r.player.id)}>
                <div className="player-avatar-sm">
                    {portraitUrl && <img src={portraitUrl} alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                    {frameUrl && <img src={frameUrl} alt="" className="frame-sm" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                </div>
                <div className="player-text">
                    <div className="player-name">{r.player.name}</div>
                    <div className="player-id-text">ID: {r.player.id}</div>
                    {r.player.guildName && <div className="guild-name">{r.player.guildName}</div>}
                </div>
            </div>

            {zones.map((zone, zi) => {
                const zd = r.zones ? r.zones.find(z => z.id === zone.id) : null;
                return (
                    <ZoneCell
                        key={zone.id}
                        zone={zone}
                        zd={zd}
                        delta={delta}
                        teamMax={teamMax}
                        onAnalysis={() => onOpenAnalysis(r, zi)}
                        onTrend={() => onOpenTrend(r.player.id, zi)}
                    />
                );
            })}

            <div className="total-score">
                <div>{formatNumber(r.score)}<ScoreDelta delta={delta} /></div>
                {r.score > 0 && r.score >= totalMaxScore && <div className="total-max-tag">总分最高</div>}
            </div>
            <div className="col-reset" />
        </div>
    );
}

const RankingRow = memo(RankingRowBase);
export default RankingRow;
