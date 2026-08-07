import React, { useEffect, useState } from 'react';
import { loadPlayer } from '../api/client.js';
import { API_CONFIG, getImageUrl } from '../api/config.js';
import { getFollows, saveFollows } from '../api/storage.js';
import { auth } from '../api/auth.js';
import { formatNumber } from '../utils/format.js';

const WZ_SCORE_KEY = 'my_wz_scores';
const PPC_SCORE_KEY = 'my_ppc_scores';

function getScores(key) {
    try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; }
}

function evaluateWzScore(total) {
    if (total >= 80000000) return { text: '传奇顶级肘子', level: 6 };
    if (total >= 50000000) return { text: '传奇大肘子', level: 5 };
    if (total >= 40000000) return { text: '传奇中肘子', level: 4 };
    if (total >= 30000000) return { text: '传奇区小肘子', level: 3 };
    if (total >= 15000000) return { text: '保送传奇', level: 2 };
    if (total >= 10000000) return { text: '会放人物技能', level: 1 };
    return { text: '菜福', level: 0 };
}

const EVAL_DESCS = ['英雄区保不了级系列', '运气好英雄区保级', '', '', '', '', ''];

function ScoreTable({ rows, columns, renderCell, onDelete }) {
    if (rows.length === 0) return null;
    return (
        <>
            <div className="score-history-title">历史记录</div>
            <table className="score-table">
                <thead>
                    <tr><th>周</th>{columns.map((c, i) => <th key={i}>{c}</th>)}<th>总分</th><th></th></tr>
                </thead>
                <tbody>
                    {rows.map(s => (
                        <tr key={s.week}>
                            <td>第{s.week}周</td>
                            {renderCell(s)}
                            <td className="score-total">{formatNumber(s.total)}</td>
                            <td><button className="score-delete" onClick={() => onDelete(s.week)}>删除</button></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </>
    );
}

// 战区分数录入
function WzScoreSection({ zones, currentWeek }) {
    const [inputs, setInputs] = useState(zones.map(() => ''));
    const [scores, setScores] = useState(getScores(WZ_SCORE_KEY));
    const [lastTotal, setLastTotal] = useState(0);

    useEffect(() => { setInputs(zones.map(() => '')); }, [zones]);

    const save = () => {
        if (zones.length === 0 || !currentWeek) return;
        let total = 0;
        const zoneScores = zones.map((z, i) => {
            const val = parseInt(inputs[i]) || 0;
            total += val;
            return { name: z.name, score: val, desc: z.description, buffs: z.buffs };
        });
        if (total === 0) return;
        const week = currentWeek;
        let all = getScores(WZ_SCORE_KEY);
        all = all.filter(s => s.week !== week);
        all.unshift({ week, zones: zoneScores, total, timestamp: Date.now() });
        localStorage.setItem(WZ_SCORE_KEY, JSON.stringify(all.slice(0, 20)));
        setScores(getScores(WZ_SCORE_KEY));
        setLastTotal(total);
        setInputs(zones.map(() => ''));
    };

    const del = week => {
        localStorage.setItem(WZ_SCORE_KEY, JSON.stringify(getScores(WZ_SCORE_KEY).filter(s => s.week !== week)));
        setScores(getScores(WZ_SCORE_KEY));
    };

    if (zones.length === 0) return <div className="score-input-label">加载战区数据中…</div>;

    const latest = scores[0];
    const columns = latest ? latest.zones.map(z => z.name) : zones.map(z => z.name);
    const ev = lastTotal > 0 ? evaluateWzScore(lastTotal) : null;

    return (
        <div className="mine-section">
            <div className="mine-section-header"><h3>我的战区</h3></div>
            <div className="score-input-grid">
                {zones.map((z, i) => (
                    <div className="score-input-item" key={i}>
                        <label className="score-input-label">{z.name}</label>
                        <input
                            type="number"
                            className="score-input-field"
                            value={inputs[i] || ''}
                            onChange={e => setInputs(v => v.map((x, xi) => (xi === i ? e.target.value : x)))}
                            placeholder="分数"
                        />
                    </div>
                ))}
            </div>
            <button className="bind-btn" onClick={save}>保存本周分数</button>
            {ev && (
                <div className="wz-evaluation">
                    <div className={`eval-tag eval-level-${ev.level}`}>{ev.text}</div>
                    {EVAL_DESCS[ev.level] && <div className="eval-desc">{EVAL_DESCS[ev.level]}</div>}
                </div>
            )}
            <ScoreTable
                rows={scores}
                columns={columns}
                renderCell={s => s.zones.map((z, i) => <td key={i}>{formatNumber(z.score)}</td>)}
                onDelete={del}
            />
        </div>
    );
}

// 幻痛囚笼分数录入
function PpcScoreSection({ bosses, currentWeek }) {
    const [inputs, setInputs] = useState(bosses.map(() => ''));
    const [scores, setScores] = useState(getScores(PPC_SCORE_KEY));

    useEffect(() => { setInputs(bosses.map(() => '')); }, [bosses]);

    const save = () => {
        if (bosses.length === 0 || !currentWeek) return;
        let total = 0;
        const bossScores = bosses.map((b, i) => {
            const val = parseInt(inputs[i]) || 0;
            total += val;
            return { name: b.name, score: val };
        });
        if (total === 0) return;
        const week = currentWeek;
        let all = getScores(PPC_SCORE_KEY);
        all = all.filter(s => s.week !== week);
        all.unshift({ week, bosses: bossScores, total, timestamp: Date.now() });
        localStorage.setItem(PPC_SCORE_KEY, JSON.stringify(all.slice(0, 20)));
        setScores(getScores(PPC_SCORE_KEY));
        setInputs(bosses.map(() => ''));
    };

    const del = week => {
        localStorage.setItem(PPC_SCORE_KEY, JSON.stringify(getScores(PPC_SCORE_KEY).filter(s => s.week !== week)));
        setScores(getScores(PPC_SCORE_KEY));
    };

    if (bosses.length === 0) return <div className="score-input-label">加载幻痛数据中…</div>;

    const maxBosses = scores.length ? Math.max(...scores.map(s => s.bosses.length)) : bosses.length;
    const columns = Array.from({ length: maxBosses }, (_, i) => `Boss${i + 1}`);

    return (
        <div className="mine-section">
            <div className="mine-section-header"><h3>我的幻痛</h3></div>
            <div className="score-input-grid">
                {bosses.map((b, i) => (
                    <div className="score-input-item" key={i}>
                        <label className="score-input-label">{b.name}</label>
                        <input
                            type="number"
                            className="score-input-field"
                            value={inputs[i] || ''}
                            onChange={e => setInputs(v => v.map((x, xi) => (xi === i ? e.target.value : x)))}
                            placeholder="分数"
                        />
                    </div>
                ))}
            </div>
            <button className="bind-btn" onClick={save}>保存本周分数</button>
            <ScoreTable
                rows={scores}
                columns={columns}
                renderCell={s => s.bosses.map((b, i) => <td key={i}>{formatNumber(b.score)}</td>)}
                onDelete={del}
            />
        </div>
    );
}

// 登录区块
function LoginSection({ onAuthChange }) {
    const [id, setId] = useState('');
    const [pw, setPw] = useState('');
    const [error, setError] = useState('');
    const [user, setUser] = useState(null);

    useEffect(() => {
        auth.init().then(() => {
            setUser(auth.isLoggedIn() ? { id: auth.playerId, name: auth.playerName } : null);
        });
    }, []);

    const doLogin = async () => {
        setError('');
        try {
            await auth.login(id.trim(), pw);
            setUser({ id: auth.playerId, name: auth.playerName });
            setPw('');
            onAuthChange && onAuthChange();
        } catch (e) {
            setError(e.message);
        }
    };

    const doRegister = async () => {
        setError('');
        try {
            await auth.register(id.trim(), pw);
            setUser({ id: auth.playerId, name: auth.playerName });
            setPw('');
            onAuthChange && onAuthChange();
        } catch (e) {
            setError(e.message);
        }
    };

    const doLogout = () => {
        auth.logout();
        setUser(null);
        onAuthChange && onAuthChange();
    };

    return (
        <div className="mine-section">
            <div className="mine-section-header"><h3>账号同步</h3></div>
            {!user ? (
                <>
                    <div className="login-input-row">
                        <input className="login-input" placeholder="游戏ID" value={id} onChange={e => setId(e.target.value)} />
                    </div>
                    <div className="login-input-row">
                        <input
                            className="login-input"
                            type="password"
                            placeholder="密码（至少4位）"
                            value={pw}
                            onChange={e => setPw(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') doLogin(); }}
                        />
                    </div>
                    <div className="data-mgmt-btns" style={{ marginTop: 4 }}>
                        <button className="bind-btn" onClick={doLogin}>登录</button>
                        <button className="bind-set-btn follow-set-btn" onClick={doRegister}>注册</button>
                    </div>
                    <div className="login-error">{error}</div>
                    <div className="login-hint">登录后绑定/关注/分数等本地数据将自动云端同步</div>
                </>
            ) : (
                <div className="logged-in-info" style={{ padding: 0 }}>
                    <div className="logged-in-user">
                        <div className="logged-in-name">{user.name || `ID: ${user.id}`}</div>
                        <div className="logged-in-id">{user.id}</div>
                    </div>
                    <div className="logged-in-status">已登录 · 数据已云端同步</div>
                    <button className="bind-btn-unbind" onClick={doLogout}>退出登录</button>
                </div>
            )}
        </div>
    );
}

// 我的页面（登录 / 绑定 / 关注 / 分数录入 / 数据导出导入）
export default function MinePage() {
    const [bindId, setBindId] = useState('');
    const [bindInfo, setBindInfo] = useState(() => {
        try { return JSON.parse(localStorage.getItem('player_bind')); } catch { return null; }
    });
    const [follows, setFollows] = useState(getFollows());
    const [msg, setMsg] = useState('');
    const [wzZones, setWzZones] = useState([]);
    const [ppcBosses, setPpcBosses] = useState([]);
    const [wzWeek, setWzWeek] = useState(null);
    const [ppcWeek, setPpcWeek] = useState(null);

    // 轻量加载当前战区/幻痛数据（区名/怪名）
    useEffect(() => {
        (async () => {
            try {
                const resp = await fetch(`${API_CONFIG.warzone}/current/16`, {
                    headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
                });
                const result = await resp.json();
                if (result.data && result.data.warzone) {
                    setWzWeek(result.data.warzone.activity);
                    setWzZones(result.data.warzone.area.zones.map(z => ({
                        name: z.name, description: z.description, buffs: z.buffs
                    })));
                }
            } catch { /* 忽略 */ }
        })();
        (async () => {
            try {
                const resp = await fetch(`${API_CONFIG.ppc}/current/4?ranking=true`, {
                    headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
                });
                const result = await resp.json();
                if (result.data && result.data.ppc) {
                    setPpcWeek(result.data.ppc.activity);
                    setPpcBosses((result.data.ppc.bosses || []).map(b => ({ name: b.name })));
                }
            } catch { /* 忽略 */ }
        })();
    }, []);

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
        const next = follows.filter(f => String(f.id) !== String(id));
        saveFollows(next);
        setFollows(next);
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
            <LoginSection />

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

            <WzScoreSection zones={wzZones} currentWeek={wzWeek} />
            <PpcScoreSection bosses={ppcBosses} currentWeek={ppcWeek} />

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
