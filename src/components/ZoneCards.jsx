import React, { useMemo, useState } from 'react';
import { formatNumber } from '../utils/format.js';
import { getImageUrl } from '../api/config.js';

// 机制名：description 冒号前（如 困兽犹斗/祸不单行），兼容全角/半角冒号
function getMechanicName(zone) {
    if (!zone || !zone.description) return '';
    const idx = zone.description.search(/[：:]/);
    if (idx > 0) return zone.description.slice(0, idx);
    return '';
}

const ZONE_ACCENTS = ['#3f6ecb', '#cf3d3d', '#b07a12'];
// 卡片顶部的一层区色薄雾（纯 rgba，不依赖 color-mix，兼容性更稳）
const ZONE_TINTS = ['rgba(63, 110, 203, 0.09)', 'rgba(207, 61, 61, 0.08)', 'rgba(176, 122, 18, 0.09)'];

// 战区卡片：区名 + 机制 + 本周榜首 / 该区最高分 + 详情弹窗
export default function ZoneCards({ zones, rankings }) {
    const [detailZone, setDetailZone] = useState(null);

    // 各区榜首（榜单已按总分排序，仍在榜内取该区最高分者）
    const zoneTop = useMemo(() => {
        const map = {};
        (rankings || []).forEach(r => {
            if (!r || !r.player || !r.zones) return;
            r.zones.forEach(zd => {
                if (!zd || zd.id == null) return;
                const score = zd.score || 0;
                if (score <= 0) return;
                const cur = map[zd.id];
                if (!cur || score > cur.score) {
                    map[zd.id] = { score, name: r.player.name || '', id: r.player.id, portrait: r.player.portrait || '' };
                }
            });
        });
        return map;
    }, [rankings]);

    if (!zones || zones.length === 0) return null;

    return (
        <section className="zones-container">
            {zones.map((zone, i) => {
                const isMixed = zone.buffs && zone.buffs.length >= 2;
                const mechanic = getMechanicName(zone);
                const top = zoneTop[zone.id];
                return (
                    <div
                        className={`zone-card${isMixed ? ' zone-card-mixed' : ''}`}
                        key={zone.id || i}
                        style={{
                            '--zone-accent': ZONE_ACCENTS[i % ZONE_ACCENTS.length],
                            '--zone-tint': ZONE_TINTS[i % ZONE_TINTS.length]
                        }}
                    >
                        <div className="zone-card-main">
                            <div className="zone-card-head">
                                <span className="zone-name">{zone.name}</span>
                                {mechanic && <span className="zone-tag">{mechanic}</span>}
                            </div>
                            {isMixed && zone.buffs && (
                                <div className="zone-card-sub">
                                    {zone.buffs.map((b, bi) => <span className="zone-sub-chip" key={bi}>{b.name}</span>)}
                                </div>
                            )}
                            <div className="zone-card-foot">
                                {top ? (
                                    <span className="zone-top-player">
                                        <span className="zone-top-avatar">
                                            <span className="zone-top-avatar-fallback">{top.name.slice(0, 1)}</span>
                                            {top.portrait && (
                                                <img
                                                    src={getImageUrl(top.portrait)}
                                                    alt=""
                                                    loading="lazy"
                                                    onError={e => { e.currentTarget.style.display = 'none'; }}
                                                />
                                            )}
                                        </span>
                                        <span>本周榜首 <b>{top.name}</b></span>
                                    </span>
                                ) : <span>暂无榜单数据</span>}
                            </div>
                        </div>
                        <div className="zone-card-right">
                            {top && <div className="zc-value">{formatNumber(top.score)}</div>}
                            <button className="zone-detail-btn" onClick={() => setDetailZone(zone)}>
                                查看详情 →
                            </button>
                        </div>
                    </div>
                );
            })}

            {detailZone && (
                <div className="modal" onClick={e => { if (e.target === e.currentTarget) setDetailZone(null); }}>
                    <div className="modal-content">
                        <button className="modal-close" onClick={() => setDetailZone(null)}>&times;</button>
                        <div className="zone-detail-header">
                            <div className="zone-detail-name">
                                {detailZone.name}
                                {getMechanicName(detailZone) && <span className="zone-tag">{getMechanicName(detailZone)}</span>}
                            </div>
                            <div className="zone-detail-desc">{detailZone.description}</div>
                        </div>
                        {detailZone.weathers && detailZone.weathers.length > 0 && (
                            <div className="boss-stage-section">
                                <div className="boss-section-title">天气</div>
                                {detailZone.weathers.map((w, wi) => (
                                    <div className="boss-buff" key={wi}>
                                        <div className="boss-buff-name">{w.name}</div>
                                        <div className="boss-buff-desc">{w.description}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {detailZone.buffs && detailZone.buffs.length > 0 && (
                            <div className="boss-stage-section">
                                <div className="boss-section-title">增益</div>
                                {detailZone.buffs.map((b, bi) => (
                                    <div className="boss-buff" key={bi}>
                                        <div className="boss-buff-name">{b.name}</div>
                                        <div className="boss-buff-desc">{b.description}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </section>
    );
}
