import React, { useState, useCallback, useEffect, useRef } from 'react';
import { loadPlayer, fetchJson } from '../api/client.js';
import { API_CONFIG, getImageUrl } from '../api/config.js';
import { getSearchHistory, saveSearchHistory, getFollows, saveFollows } from '../api/storage.js';
import { formatNumber, getQualityInfo } from '../utils/format.js';
import CharacterModal from './Modals/CharacterModal.jsx';
import HistoryModal from './Modals/HistoryModal.jsx';

const QUALITY_MAP = { 1: 'B', 2: 'A', 3: 'S', 4: 'SS', 5: 'SSS', 6: 'SSS+' };

function CharacterCard({ c, onClick }) {
    const iconUrl = c.fashionIcon ? getImageUrl(c.fashionIcon) : '';
    const isHidden = c.level === 0;
    return (
        <div className={`character-card${isHidden ? ' character-hidden' : ''}`} onClick={onClick}>
            {iconUrl && <img className="character-icon" src={iconUrl} alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />}
            <div className="character-info">
                <div className="character-name">
                    {c.characterName}
                    {c.frameName && <span className="character-frame">{c.frameName}</span>}
                </div>
                <div className="character-stats">
                    {!isHidden && <span>Lv.{c.level}</span>}
                    {getQualityInfo(c.quality) && <span className={`quality-tag quality-${c.quality}`}>{getQualityInfo(c.quality)}</span>}
                    {isHidden && <span className="char-tag">隐藏</span>}
                </div>
            </div>
        </div>
    );
}

// 玩家查询页
export default function PlayerPage({ pendingPlayerId }) {
    const [input, setInput] = useState('');
    const [history, setHistory] = useState([]);
    const [player, setPlayer] = useState(null);
    const [characters, setCharacters] = useState([]);
    const [error, setError] = useState('');
    const [follows, setFollows] = useState(getFollows());
    const [charDetail, setCharDetail] = useState(null); // { charId }
    const [showHistory, setShowHistory] = useState(false);
    const [weekOptions, setWeekOptions] = useState({ min: null, max: null });
    const queryingRef = useRef(null); // AbortController：查询新玩家时取消旧请求

    // 轻量获取周范围（历史战绩用）；与排行榜页同 URL，走内存缓存避免重复请求
    useEffect(() => {
        (async () => {
            try {
                const result = await fetchJson(`${API_CONFIG.warzone}/current/16`);
                if (result.data && result.data.activities) {
                    setWeekOptions({ min: result.data.activities.min, max: result.data.activities.max });
                }
            } catch { /* 忽略 */ }
        })();
    }, []);

    const refreshHistory = useCallback(() => setHistory(getSearchHistory()), []);

    useEffect(() => { refreshHistory(); }, [refreshHistory]);

    const query = useCallback(async id => {
        if (!id) return;
        if (queryingRef.current) queryingRef.current.abort();
        queryingRef.current = new AbortController();
        const signal = queryingRef.current.signal;
        setError('');
        try {
            const data = await loadPlayer(id, signal);
            if (signal.aborted) return;
            setPlayer(data.player);
            setCharacters(data.characters || []);
            // 记历史
            const h = getSearchHistory().filter(x => String(x.id) !== String(data.player.id));
            h.unshift({ id: data.player.id, name: data.player.name, portrait: data.player.portrait });
            saveSearchHistory(h.slice(0, 20));
            refreshHistory();
        } catch (e) {
            if (!signal.aborted) setError('未找到该玩家');
        }
    }, [refreshHistory]);

    // 排行榜跳转
    useEffect(() => {
        if (pendingPlayerId) query(pendingPlayerId);
    }, [pendingPlayerId, query]);

    const toggleFollow = useCallback((id, name, portrait) => {
        const f = getFollows();
        const exists = f.some(x => String(x.id) === String(id));
        let next;
        if (exists) {
            next = f.filter(x => String(x.id) !== String(id));
        } else {
            next = [{ id, name, portrait }, ...f].slice(0, 20);
        }
        saveFollows(next);
        setFollows(next);
    }, []);

    const acquiredChars = characters.filter(c => c.acquired);

    return (
        <div>
            <header className="header">
                <h1>玩家查询</h1>
                <div className="search-box">
                    <input
                        type="text"
                        placeholder="输入玩家ID"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') query(input.trim()); }}
                    />
                    <button onClick={() => query(input.trim())}>查询</button>
                </div>
            </header>

            <div className="history-section">
                <div className="history-header">
                    <h3>查询历史</h3>
                    <button
                        className="clear-btn"
                        onClick={() => { if (confirm('确定清空查询历史？')) { saveSearchHistory([]); refreshHistory(); } }}
                    >
                        清空
                    </button>
                </div>
                <div className="history-list">
                    {history.length === 0 && <span className="history-empty">暂无查询记录</span>}
                    {history.map(h => (
                        <div className="history-item" key={h.id} onClick={() => query(h.id)}>
                            {h.portrait && <img className="history-avatar" src={getImageUrl(h.portrait)} alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                            <div className="history-info">
                                <div className="history-name">{h.name}</div>
                                <div className="history-id">ID: {h.id}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {error && <div className="team-empty">{error}</div>}

            {player && (
                <div className="player-profile">
                    <div className="player-avatar">
                        {player.portrait && <img id="playerPortrait" src={getImageUrl(player.portrait)} alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                        {player.frame && <img id="playerFrame" src={getImageUrl(player.frame)} alt="" className="frame" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                    </div>
                    <div className="player-details">
                        <h2>{player.name}</h2>
                        <div className="player-meta">
                            <span>Lv.{player.level}</span>
                            <span>{player.sign || '暂无签名'}</span>
                        </div>
                        <div className="player-guild">公会：{player.guildName || '暂无公会'}</div>
                        <div className="player-likes">点赞：{player.likes || 0}</div>
                        <div className="player-actions">
                            <button className="bind-set-btn" onClick={() => toggleFollow(player.id, player.name, player.portrait)}>
                                {follows.some(f => String(f.id) === String(player.id)) ? '已关注' : '关注'}
                            </button>
                            <button className="bind-set-btn follow-set-btn" onClick={() => setShowHistory(true)}>历史战绩</button>
                        </div>
                    </div>
                </div>
            )}

            {player && (
                <div className="characters-section">
                    <h3>角色列表 <span>({acquiredChars.length})</span></h3>
                    <div className="characters-grid">
                        {acquiredChars.map(c => (
                            <CharacterCard key={c.id} c={c} onClick={() => setCharDetail({ charId: c.id })} />
                        ))}
                    </div>
                </div>
            )}

            <div className="history-section">
                <div className="history-header">
                    <h3>关注列表</h3>
                    <button className="clear-btn" onClick={() => { if (confirm('确定清空关注？')) { saveFollows([]); setFollows([]); } }}>清空</button>
                </div>
                <div className="follow-list">
                    {follows.length === 0 && <span className="follow-empty">暂无关注</span>}
                    {follows.map(f => (
                        <div className="follow-item" key={f.id}>
                            {f.portrait && <img className="follow-avatar" src={getImageUrl(f.portrait)} alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                            <div className="follow-info">
                                <div className="follow-name">{f.name}</div>
                                <div className="follow-id">ID: {f.id}</div>
                            </div>
                            <div className="follow-actions">
                                <button className="follow-view" onClick={() => query(f.id)}>查看</button>
                                <button className="follow-remove" onClick={() => toggleFollow(f.id)}>取关</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {charDetail && player && (
                <CharacterModal
                    playerId={player.id}
                    charId={charDetail.charId}
                    onClose={() => setCharDetail(null)}
                />
            )}
            {showHistory && player && (
                <HistoryModal
                    playerId={player.id}
                    playerName={player.name}
                    weekOptions={weekOptions}
                    onClose={() => setShowHistory(false)}
                />
            )}
        </div>
    );
}
