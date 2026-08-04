import React, { useState } from 'react';
import { loadPlayer } from '../api/client.js';
import { getImageUrl } from '../api/config.js';
import { getFollows, saveFollows } from '../api/storage.js';
import { formatNumber } from '../utils/format.js';

// 我的页面（绑定 / 关注 / 数据导出导入）
export default function MinePage() {
    const [bindId, setBindId] = useState('');
    const [bindInfo, setBindInfo] = useState(() => {
        try { return JSON.parse(localStorage.getItem('player_bind')); } catch { return null; }
    });
    const [follows, setFollows] = useState(getFollows());
    const [msg, setMsg] = useState('');

    const loadAndBind = async () => {
        if (!bindId.trim()) return;
        try {
            const data = await loadPlayer(bindId.trim());
            const info = { id: data.player.id, name: data.player.name, portrait: data.player.portrait };
            localStorage.setItem('player_bind', JSON.stringify(info));
            setBindInfo(info);
            setMsg('绑定成功');
            setTimeout(() => setMsg(''), 3000);
        } catch {
            setMsg('未找到该玩家');
            setTimeout(() => setMsg(''), 3000);
        }
    };

    const unbind = () => {
        localStorage.removeItem('player_bind');
        setBindInfo(null);
    };

    const clearFollows = () => {
        if (confirm('确定清空关注？')) {
            saveFollows([]);
            setFollows([]);
        }
    };

    const removeFollow = id => {
        saveFollows(follows.filter(f => String(f.id) !== String(id)));
        setFollows(follows.filter(f => String(f.id) !== String(id)));
    };

    const exportData = () => {
        const payload = {
            version: 1,
            exportedAt: new Date().toISOString(),
            player_bind: localStorage.getItem('player_bind'),
            player_search_history: localStorage.getItem('player_search_history'),
            player_follows: localStorage.getItem('player_follows'),
            my_wz_scores: localStorage.getItem('my_wz_scores'),
            my_ppc_scores: localStorage.getItem('my_ppc_scores')
        };
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `huaxu-data-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
        setMsg('导出成功');
        setTimeout(() => setMsg(''), 3000);
    };

    const importData = file => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const data = JSON.parse(reader.result);
                if (!data.version) throw new Error('格式错误');
                const merge = (key, idField) => {
                    const local = JSON.parse(localStorage.getItem(key) || '[]');
                    const incoming = JSON.parse(data[key] || '[]');
                    const seen = new Set(local.map(x => String(x[idField])));
                    const merged = [...local];
                    incoming.forEach(x => {
                        if (!seen.has(String(x[idField]))) merged.push(x);
                    });
                    localStorage.setItem(key, JSON.stringify(merged));
                };
                ['player_search_history', 'player_follows'].forEach(k => merge(k, 'id'));
                ['my_wz_scores', 'my_ppc_scores'].forEach(k => merge(k, 'week'));
                if (data.player_bind && !localStorage.getItem('player_bind')) {
                    localStorage.setItem('player_bind', data.player_bind);
                    setBindInfo(JSON.parse(data.player_bind));
                }
                setFollows(getFollows());
                setMsg('导入完成');
                setTimeout(() => setMsg(''), 3000);
            } catch {
                setMsg('导入失败：文件格式错误');
                setTimeout(() => setMsg(''), 3000);
            }
        };
        reader.readAsText(file);
    };

    return (
        <div>
            <div className="mine-section">
                <div className="mine-section-header"><h3>绑定角色</h3></div>
                {!bindInfo ? (
                    <div className="bind-empty">
                        <input
                            type="text"
                            className="bind-input"
                            placeholder="输入玩家ID绑定"
                            value={bindId}
                            onChange={e => setBindId(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') loadAndBind(); }}
                        />
                        <button className="bind-btn" onClick={loadAndBind}>绑定</button>
                    </div>
                ) : (
                    <div className="bind-player" style={{ display: 'flex' }}>
                        {bindInfo.portrait && <img className="bind-avatar" src={getImageUrl(bindInfo.portrait)} alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                        <div className="bind-info">
                            <div className="bind-name">{bindInfo.name}</div>
                            <div className="bind-id">ID: {bindInfo.id}</div>
                        </div>
                        <button className="bind-btn-unbind" onClick={unbind}>解绑</button>
                    </div>
                )}
            </div>

            <div className="mine-section">
                <div className="mine-section-header">
                    <h3>关注列表</h3>
                    <button className="clear-btn" onClick={clearFollows}>清空</button>
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
                            <button className="follow-remove" onClick={() => removeFollow(f.id)}>取关</button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="mine-section">
                <div className="mine-section-header"><h3>数据管理</h3></div>
                <div className="data-mgmt-btns">
                    <button className="bind-set-btn" onClick={exportData}>导出数据</button>
                    <label className="bind-set-btn" style={{ cursor: 'pointer' }}>
                        导入数据
                        <input type="file" accept=".json" style={{ display: 'none' }} onChange={e => { importData(e.target.files[0]); e.target.value = ''; }} />
                    </label>
                </div>
                {msg && <div className="data-mgmt-msg">{msg}</div>}
                <div className="data-mgmt-desc">数据仅存储于本地（localStorage），可通过导出备份。</div>
            </div>
        </div>
    );
}
