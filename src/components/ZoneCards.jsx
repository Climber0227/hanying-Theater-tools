import React, { useState } from 'react';

function getMonsterTag(desc) {
    if (!desc) return '';
    if (desc.includes('单体')) return '单怪';
    if (desc.includes('双体')) return '双怪';
    if (desc.includes('群体')) return '群怪';
    return '';
}

// 战区卡片 + 详情弹窗
export default function ZoneCards({ zones }) {
    const [detailZone, setDetailZone] = useState(null);

    if (!zones || zones.length === 0) return null;

    return (
        <section className="zones-container">
            {zones.map((zone, i) => {
                const monsterTag = getMonsterTag(zone.description);
                const isMixed = zone.buffs && zone.buffs.length >= 2;
                return (
                    <div className={`zone-card${isMixed ? ' zone-card-mixed' : ''}`} key={zone.id || i}>
                        <div className="zone-card-info">
                            <div className="zone-name">
                                {zone.name}
                                {monsterTag && <span className="zone-tag">{monsterTag}</span>}
                            </div>
                            {isMixed && (
                                <div className="zone-card-sub">
                                    {zone.buffs.map((b, bi) => <span className="zone-sub-chip" key={bi}>{b.name}</span>)}
                                </div>
                            )}
                        </div>
                        <div className="zone-card-actions">
                            <button className="zone-detail-btn" onClick={() => setDetailZone(zone)}>详情</button>
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
                                {getMonsterTag(detailZone.description) && <span className="zone-tag">{getMonsterTag(detailZone.description)}</span>}
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
