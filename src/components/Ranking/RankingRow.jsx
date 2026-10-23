import React, { memo } from 'react';
import { getImageUrl } from '../../api/config.js';
import { formatNumber, formatScoreCompact, getQualityInfo, getTeamKey } from '../../utils/format.js';
import { getRankDelta } from '../../utils/ranking.js';

export const ROW_HEIGHT = 96;
export const ROW_HEIGHT_MOBILE = 112;

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
    return null; // 没有变化就不占位，别再挂个「0」
}

function ZoneScoreDelta({ diff }) {
    if (diff == null || diff === 0) return null;
    if (diff > 0) return <span className="score-delta-up">+{formatScoreCompact(diff)}</span>;
    return <span className="score-delta-down">-{formatScoreCompact(Math.abs(diff))}</span>;
}

// 同阶级阵容最高对比：只留「同阶最高 / 低 xx」，完整分数放 title
export function TeamCompareTag({ zd, teamMax, zone }) {
    if (!zd || !zd.characters || zd.characters.length === 0) return null;
    const key = getTeamKey(zd.characters);
    const max = teamMax && teamMax[zone.id] && teamMax[zone.id][key];
    if (!max) return null;
    const zscore = zd.score || 0;
    if (zscore <= 0) return null;
    const diff = max.score - zscore;
    return diff <= 0
        ? <span className="zone-max-tag" title={`同阶级阵容最高分 ${formatNumber(max.score)}`}>同阶最高</span>
        : (
            <span
                className="zone-diff-tag"
                title={`同阶级阵容最高分 ${formatNumber(max.score)}，低 ${formatNumber(diff)}`}
            >
                低 {formatScoreCompact(diff)}
            </span>
        );
}

// 每区的三个角色：小头像 + 名字 + 品质 + 战力。
// 头像走本地 96px 小图（/img/chars/，单张 2–4KB），不然这里一次要拉 90 张 1024×1024 的原图。
function CharList({ chars }) {
    if (!chars || chars.length === 0) return null;
    return chars.map((c, i) => (
        <div
            className="char-row"
            key={i}
            title={c.cubName ? `${c.characterName} · 辅助机 ${c.cubName}` : c.characterName}
        >
            {c.icon ? (
                <img
                    className="char-icon-sm"
                    src={getImageUrl(c.icon)}
                    alt=""
                    width="18"
                    height="18"
                    loading="lazy"
                    decoding="async"
                    onError={e => { e.currentTarget.style.visibility = 'hidden'; }}
                />
            ) : (
                <span className="char-icon-sm char-icon-empty" aria-hidden="true" />
            )}
            <span className="char-name-sm">{c.characterName}</span>
            {getQualityInfo(c.rank) && <span className={`rank-quality-sm quality-${c.rank}`}>{getQualityInfo(c.rank)}</span>}
            {c.bp ? <span className="char-bp">{c.bp}</span> : null}
        </div>
    ));
}

const ZoneCell = memo(function ZoneCell({ zone, zd, delta, teamMax, playerId, zoneIndex, onOpenAnalysis, onOpenTrend }) {
    const zdDiff = delta && zd && Object.prototype.hasOwnProperty.call(delta.zoneScores, zone.id)
        ? (zd.score || 0) - (delta.zoneScores[zone.id] || 0)
        : null;
    return (
        <div className="zone-detail">
            <div className="zone-actions">
                <button className="zone-sa-btn" onClick={e => { e.stopPropagation(); onOpenAnalysis(playerId, zoneIndex); }}>分析</button>
                <button className="zone-sa-btn" onClick={e => { e.stopPropagation(); onOpenTrend(playerId, zoneIndex); }}>趋势</button>
            </div>
            <div className="zone-score-line">
                <span className="zone-score-val">{zd ? formatNumber(zd.score) : '--'}</span>
                {zdDiff != null && <ZoneScoreDelta diff={zdDiff} />}
                <TeamCompareTag zd={zd} teamMax={teamMax} zone={zone} />
            </div>
            <div className="zone-chars"><CharList chars={zd && zd.characters} /></div>
        </div>
    );
});

function MobileZoneBar({ zones, r, delta, teamMax }) {
    return (
        <div className="mobile-zone-bar">
            {zones.map(zone => {
                const zd = r.zones ? r.zones.find(z => z.id === zone.id) : null;
                const zdDiff = delta && zd && Object.prototype.hasOwnProperty.call(delta.zoneScores, zone.id)
                    ? (zd.score || 0) - (delta.zoneScores[zone.id] || 0)
                    : null;
                // 手机端只保留「同阶」标记，避免区名被挤断
                const teamKey = zd && zd.characters && zd.characters.length ? getTeamKey(zd.characters) : null;
                const teamBest = teamKey && teamMax && teamMax[zone.id] ? teamMax[zone.id][teamKey] : null;
                const isTeamMax = !!(teamBest && (zd.score || 0) > 0 && teamBest.score - (zd.score || 0) <= 0);
                return (
                    <div className="mobile-zone-seg" key={zone.id}>
                        <div className="mobile-zone-head">
                            <span className="mobile-zone-name">{zone.name}</span>
                            {isTeamMax && (
                                <span
                                    className="zone-max-tag zone-max-tag-sm"
                                    title={`同阶级阵容最高分 ${formatNumber(teamBest.score)}`}
                                >
                                    同阶
                                </span>
                            )}
                        </div>
                        <span className="mobile-zone-score">
                            {zd ? formatNumber(zd.score) : '--'}
                            {zdDiff != null && zdDiff !== 0 && (
                                zdDiff > 0
                                    ? <span className="score-delta-up">+{formatScoreCompact(zdDiff)}</span>
                                    : <span className="score-delta-down">-{formatScoreCompact(Math.abs(zdDiff))}</span>
                            )}
                        </span>
                        {zd && zd.characters && zd.characters.length > 0 && (
                            <span className="mobile-zone-chars">
                                {zd.characters.map((c, i) => (
                                    c.icon ? (
                                        <img
                                            key={i}
                                            src={getImageUrl(c.icon)}
                                            alt=""
                                            width="15"
                                            height="15"
                                            loading="lazy"
                                            decoding="async"
                                            title={c.characterName}
                                            onError={e => { e.currentTarget.style.display = 'none'; }}
                                        />
                                    ) : null
                                ))}
                            </span>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function Avatar({ portraitUrl, frameUrl, name }) {
    return (
        <div className="player-avatar-sm">
            <span className="avatar-fallback" aria-hidden="true">{(name || '?').slice(0, 1)}</span>
            {portraitUrl && (
                <img
                    src={portraitUrl}
                    alt=""
                    width="40"
                    height="40"
                    loading="lazy"
                    decoding="async"
                    onError={e => { e.currentTarget.style.display = 'none'; }}
                />
            )}
            {frameUrl && (
                <img
                    src={frameUrl}
                    alt=""
                    className="frame-sm"
                    width="46"
                    height="46"
                    loading="lazy"
                    decoding="async"
                    onError={e => { e.currentTarget.style.display = 'none'; }}
                />
            )}
        </div>
    );
}

function MobileRow({ r, zones, delta, teamMax, topN, displayRank, portraitUrl, frameUrl, onOpenPlayer }) {
    return (
        <>
            <div className={`rank-num${topN ? ` top-${displayRank}` : ''}`}>
                {topN && <span className={`rank-medal medal-${displayRank}`}>{displayRank}</span>}
                {!topN && displayRank}
                <RankDelta delta={delta} />
            </div>
            <div className="player-info ranking-player mobile-player" onClick={e => { e.stopPropagation(); onOpenPlayer(r.player.id); }}>
                <Avatar portraitUrl={portraitUrl} frameUrl={frameUrl} name={r.player.name} />
                <div className="player-text">
                    <div className="player-name">{r.player.name}</div>
                    <div className="player-sub">ID {r.player.id}{r.player.guildName ? ` · ${r.player.guildName}` : ''}</div>
                </div>
            </div>
            <div className="total-score mobile-total">
                <div>
                    {formatNumber(r.score)}
                    <ScoreDelta delta={delta} />
                </div>
            </div>
            <MobileZoneBar zones={zones} r={r} delta={delta} teamMax={teamMax} />
        </>
    );
}

function RankingRowBase({ index, style, rows, zones, teamMax, totalMaxScore, prevSnapshot, isMobile, onOpenPlayer, onOpenAnalysis, onOpenTrend, onOpenMobileRow }) {
    const r = rows[index];
    // 显示真实排名（源站 r.rank）；筛选/单区排序后行号会变，奖牌必须跟真实排名走
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
                    teamMax={teamMax}
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
                {topN && <span className={`rank-medal medal-${displayRank}`}>{displayRank}</span>}
                {!topN && displayRank}
                <RankDelta delta={delta} />
            </div>

            <div className="player-info ranking-player" onClick={() => onOpenPlayer(r.player.id)}>
                <Avatar portraitUrl={portraitUrl} frameUrl={frameUrl} name={r.player.name} />
                <div className="player-text">
                    <div className="player-name">{r.player.name}</div>
                    <div className="player-sub">ID {r.player.id}{r.player.guildName ? ` · ${r.player.guildName}` : ''}</div>
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
                <div>
                    {formatNumber(r.score)}
                    <ScoreDelta delta={delta} />
                </div>
                {r.score > 0 && r.score >= totalMaxScore && <div className="total-max-tag">总分最高</div>}
            </div>
        </div>
    );
}

const RankingRow = memo(RankingRowBase);
export default RankingRow;
