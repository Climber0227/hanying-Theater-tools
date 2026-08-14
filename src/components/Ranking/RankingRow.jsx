import React, { memo } from 'react';
import { getImageUrl } from '../../api/config.js';
import { formatNumber, formatScoreCompact, getQualityInfo, getTeamKey } from '../../utils/format.js';
import { getRankDelta } from '../../utils/ranking.js';

export const ROW_HEIGHT = 152;
export const ROW_HEIGHT_MOBILE = 96;

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

export function TeamCompareTag({ zd, teamMax, zone }) {
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
            {c.icon && <img className="char-icon-sm" src={getImageUrl(c.icon)} alt="" decoding="async" onError={e => { e.currentTarget.style.display = 'none'; }} />}
            <span className="char-name-sm">{c.characterName}</span>
            {getQualityInfo(c.rank) && <span className={`rank-quality-sm quality-${c.rank}`}>{getQualityInfo(c.rank)}</span>}
            <span className="char-bp">{c.bp}</span>
            {c.cubIcon && <img className="cub-icon-sm" src={getImageUrl(c.cubIcon)} alt="" decoding="async" title={c.cubName || ''} onError={e => { e.currentTarget.style.display = 'none'; }} />}
        </div>
    ));
}

const ZoneCell = memo(function ZoneCell({ zone, zd, delta, teamMax, playerId, zoneIndex, onOpenAnalysis, onOpenTrend }) {
    return (
        <div className="zone-detail">
            <div className="zone-actions">
                <button className="zone-sa-btn" onClick={e => { e.stopPropagation(); onOpenAnalysis(playerId, zoneIndex); }}>分析</button>
                <button className="zone-sa-btn zone-trend-btn" onClick={e => { e.stopPropagation(); onOpenTrend(playerId, zoneIndex); }}>趋势</button>
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
});

const MEDALS = { 1: '冠军', 2: '亚军', 3: '季军' };

function MobileZoneBar({ zones, r, delta }) {
    return (
        <div className="mobile-zone-bar">
            {zones.map((zone, zi) => {
                const zd = r.zones ? r.zones.find(z => z.id === zone.id) : null;
                const zdDiff = delta && zd && Object.prototype.hasOwnProperty.call(delta.zoneScores, zone.id)
                    ? (zd.score || 0) - (delta.zoneScores[zone.id] || 0)
                    : null;
                return (
                    <div className="mobile-zone-seg" key={zone.id}>
                        <span className="mobile-zone-name">{zone.name}</span>
                        <span className="mobile-zone-score">
                            {zd ? formatNumber(zd.score) : '--'}
                            {zdDiff != null && (
                                zdDiff > 0
                                    ? <span className="score-delta-up">+{formatScoreCompact(zdDiff)}</span>
                                    : zdDiff < 0
                                        ? <span className="score-delta-down">-{formatScoreCompact(Math.abs(zdDiff))}</span>
                                        : <span className="score-delta-same">0</span>
                            )}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

function MobileRow({ r, zones, delta, topN, displayRank, portraitUrl, frameUrl, onOpenPlayer }) {
    return (
        <>
            <div className={`rank-num${topN ? ` top-${displayRank}` : ''}`}>
                {topN && <span className={`rank-medal medal-${displayRank}`}>{displayRank}</span>}
                {!topN && displayRank}
                <RankDelta delta={delta} />
            </div>
            <div className="player-info ranking-player mobile-player" onClick={e => { e.stopPropagation(); onOpenPlayer(r.player.id); }}>
                <div className="player-avatar-sm">
                    {portraitUrl && <img src={portraitUrl} alt="" decoding="async" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                    {frameUrl && <img src={frameUrl} alt="" className="frame-sm" decoding="async" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                </div>
                <div className="player-text">
                    <div className="player-name">{r.player.name}</div>
                    <div className="player-id-text">ID: {r.player.id}</div>
                </div>
            </div>
            <div className="total-score mobile-total">
                <div>{formatNumber(r.score)}<ScoreDelta delta={delta} /></div>
            </div>
            <MobileZoneBar zones={zones} r={r} delta={delta} />
        </>
    );
}

function RankingRowBase({ index, style, rows, zones, teamMax, totalMaxScore, prevSnapshot, isMobile, onOpenPlayer, onOpenAnalysis, onOpenTrend, onOpenMobileRow }) {
    const r = rows[index];
    // 显示真实排名（源站 r.rank）：筛选/单区排序后行号会变，但排名/奖牌必须与真实排名一致，
    // 否则"冠军/亚军/季军"会错指给过滤视图前 3 名；老数据无 rank 时回退为视图行号
    const displayRank = r.rank || (index + 1);
    const topN = displayRank <= 3;
    const portraitUrl = r.player.portrait ? getImageUrl(r.player.portrait) : '';
    const frameUrl = r.player.frame ? getImageUrl(r.player.frame) : '';
    const delta = getRankDelta(r.player.id, r.rank, r.score, prevSnapshot);

    if (isMobile) {
        return (
            <div
                className={`ranking-row ranking-row-mobile${topN ? ` top-${displayRank}-row` : ''}`}
                style={style}
                onClick={() => onOpenMobileRow && onOpenMobileRow(r)}
            >
                <MobileRow
                    r={r}
                    zones={zones}
                    delta={delta}
                    topN={topN}
                    displayRank={displayRank}
                    portraitUrl={portraitUrl}
                    frameUrl={frameUrl}
                    onOpenPlayer={onOpenPlayer}
                />
            </div>
        );
    }

    return (
        <div className={`ranking-row${topN ? ` top-${displayRank}-row` : ''}`} style={style}>
            <div className={`rank-num${topN ? ` top-${displayRank}` : ''}`}>
                {topN && <><span className={`rank-medal medal-${displayRank}`}>{displayRank}</span><span className="rank-medal-label">{MEDALS[displayRank]}</span></>}
                {!topN && displayRank}
                <RankDelta delta={delta} />
            </div>

            <div className="player-info ranking-player" onClick={() => onOpenPlayer(r.player.id)}>
                <div className="player-avatar-sm">
                    {portraitUrl && <img src={portraitUrl} alt="" decoding="async" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                    {frameUrl && <img src={frameUrl} alt="" className="frame-sm" decoding="async" onError={e => { e.currentTarget.style.display = 'none'; }} />}
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
                        playerId={r.player.id}
                        zoneIndex={zi}
                        onOpenAnalysis={onOpenAnalysis}
                        onOpenTrend={onOpenTrend}
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
