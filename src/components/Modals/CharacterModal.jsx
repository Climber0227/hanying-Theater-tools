import React, { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import { API_CONFIG, getImageUrl } from '../../api/config.js';

function cleanDesc(text) {
    return (text || '').replace(/<color=[^>]*>/g, '').replace(/<\/color>/g, '');
}

function SkillList({ skills, leapSkills }) {
    const items = [
        ...(skills || []).map(s => ({ ...s, leap: false })),
        ...(leapSkills || []).map(s => ({ ...s, leap: true }))
    ];
    if (items.length === 0) return <div className="char-loading">暂无技能数据</div>;
    return (
        <div className="skill-list">
            {items.map((skill, i) => (
                <div className="skill-item" key={i}>
                    <div className="skill-header">
                        {skill.icon && <img className="skill-icon" src={getImageUrl(skill.icon)} alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                        <span className="skill-name">{skill.name}</span>
                        <span className="skill-level">
                            {skill.leap
                                ? `跃升 Lv.${skill.level && skill.level.total}`
                                : `Lv.${skill.level ? (skill.level.total || skill.level.base) : ''}`}
                        </span>
                    </div>
                    {(skill.descriptions || []).map((desc, di) => (
                        <div key={di}>
                            {desc.title && <div className="skill-desc-title">{desc.title.replace(/<[^>]*>/g, '')}</div>}
                            <div className="skill-desc-text">{cleanDesc(desc.description)}</div>
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}

function MemoriesTab({ memories, suits }) {
    if ((!memories || memories.length === 0) && (!suits || suits.length === 0)) {
        return <div className="char-loading">暂无意识数据</div>;
    }
    return (
        <>
            <div className="memory-grid">
                {(memories || []).map((mem, i) => (
                    <div className="memory-item" key={i}>
                        {mem.icon && <img className="memory-icon" src={getImageUrl(mem.icon)} alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                        <div className="memory-info">
                            <div className="memory-name">{mem.name}</div>
                            <div className="memory-level">Lv.{mem.level} 突破{mem.breakthrough}</div>
                            <div className="memory-resonance">
                                {(mem.resonances || []).map(r => `${r.name}${r.hypertuned ? ' (超频)' : ''}`).join(' / ')}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            {(suits || []).length > 0 && (
                <div style={{ marginTop: 16 }}>
                    {suits.map((suit, i) => (
                        <div className="memory-item" style={{ marginBottom: 8 }} key={i}>
                            {suit.icon && <img className="memory-icon" src={getImageUrl(suit.icon)} alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                            <div className="memory-info">
                                <div className="memory-name">{suit.name} ({suit.level}件套)</div>
                                {(suit.skills || []).map((s, si) => (
                                    <div className="memory-resonance" key={si}>{s.level}件: {s.description} {s.active ? '✓' : ''}</div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}

function WeaponTab({ weapon }) {
    if (!weapon) return <div className="char-loading">暂无武器数据</div>;
    return (
        <div className="weapon-section">
            {weapon.icon && <img className="weapon-icon" src={getImageUrl(weapon.icon)} alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />}
            <div className="weapon-info">
                <div className="weapon-name">{weapon.name} Lv.{weapon.level} 突破{weapon.breakthrough}</div>
                {weapon.weaponSkill && (
                    <div className="weapon-skill-name">{weapon.weaponSkill.name}: <span style={{ color: 'var(--text-2)' }}>{weapon.weaponSkill.description}</span></div>
                )}
                {(weapon.resonances || []).map((r, i) => (
                    <div className="weapon-skill-name" key={i}>{r.name}: <span style={{ color: 'var(--text-2)' }}>{r.description}</span></div>
                ))}
                {weapon.harmonization && <div className="weapon-resonance">谐振: {weapon.harmonization.name}</div>}
            </div>
        </div>
    );
}

function CubTab({ cub }) {
    if (!cub) return <div className="char-loading">暂无辅助机数据</div>;
    return (
        <div className="cub-section">
            {cub.icon && <img className="cub-icon" src={getImageUrl(cub.icon)} alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />}
            <div className="cub-info">
                <div className="cub-name">{cub.name} Lv.{cub.level}</div>
                {(cub.skills || []).map((s, i) => (
                    <div className="cub-skill" key={i}>{s.name}: {s.description}</div>
                ))}
            </div>
        </div>
    );
}

// 角色详情弹窗（技能/意识/武器/辅助机 4 Tab）
export default function CharacterModal({ playerId, charId, onClose }) {
    const [data, setData] = useState(null);
    const [tab, setTab] = useState('skills');
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        setData(null);
        setError('');
        (async () => {
            try {
                const resp = await fetch(`${API_CONFIG.player}/${playerId}/characters/${charId}`, {
                    headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
                });
                const result = await resp.json();
                if (!cancelled) {
                    if (result.status === 'success' && result.data && result.data.character) {
                        setData(result.data);
                    } else {
                        setError('加载失败');
                    }
                }
            } catch {
                if (!cancelled) setError('加载失败');
            }
        })();
        return () => { cancelled = true; };
    }, [playerId, charId]);

    const char = data && data.character;
    const elementStr = char && char.elements ? char.elements.map(e => e.element).join('/') : '';
    const iconUrl = data && data.fashion && data.fashion.iconHead ? getImageUrl(data.fashion.iconHead) : '';

    return (
        <Modal onClose={onClose}>
            {error && <div className="char-loading">{error}</div>}
            {!char && !error && <div className="char-loading">加载中...</div>}
            {char && (
                <>
                    <div className="char-header">
                        <div className="char-icon-wrap">
                            {iconUrl && <img src={iconUrl} alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                        </div>
                        <div className="char-basic">
                            <div className="char-name-row">
                                <span className="char-detail-name">{char.characterName}</span>
                                <span className="char-frame-name">{char.frameName}</span>
                            </div>
                            <div className="char-tags">
                                {char.class && <span className="char-tag">{char.class}</span>}
                                {elementStr && <span className="char-tag">{elementStr}</span>}
                                <span className="char-tag">{char.frameType === 'omniframe' ? 'S级' : 'A级'}</span>
                                {char.gradeName && <span className="char-tag">{char.gradeName}</span>}
                            </div>
                            <div className="char-stats">
                                Lv.<span>{char.level}</span>
                                ★<span>{char.quality}</span>
                                战力<span>{Math.floor(char.bp || 0)}</span>
                                好感<span>{char.trustLevel || 0}</span>
                                觉醒<span>{char.awakeningLevel || 0}</span>
                            </div>
                        </div>
                    </div>

                    <div className="char-tabs">
                        <button className={`char-tab${tab === 'skills' ? ' active' : ''}`} onClick={() => setTab('skills')}>技能</button>
                        <button className={`char-tab${tab === 'memories' ? ' active' : ''}`} onClick={() => setTab('memories')}>意识</button>
                        <button className={`char-tab${tab === 'weapon' ? ' active' : ''}`} onClick={() => setTab('weapon')}>武器</button>
                        <button className={`char-tab${tab === 'cub' ? ' active' : ''}`} onClick={() => setTab('cub')}>辅助机</button>
                    </div>

                    {tab === 'skills' && <SkillList skills={data.skills} leapSkills={data.leapSkills} />}
                    {tab === 'memories' && <MemoriesTab memories={data.memories} suits={data.suits} />}
                    {tab === 'weapon' && <WeaponTab weapon={data.weapon} />}
                    {tab === 'cub' && <CubTab cub={data.cub} />}
                </>
            )}
        </Modal>
    );
}
