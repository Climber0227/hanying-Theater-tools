import React, { useEffect, useMemo, useRef, useState } from 'react';
import { fetchJson } from '../api/client.js';
import { API_CONFIG, getImageUrl } from '../api/config.js';
import { getFollows, saveFollows } from '../api/storage.js';
import { auth } from '../api/auth.js';
import {
    getKuroToken, clearKuroToken,
    getKuroPhone, setKuroPhone, clearKuroPhone,
    sendSmsCode, kuroLogin, showGeetestCaptcha,
    getKuroRoleList, getAreaData, getPrisonerCageData, getRoleIndexData
} from '../api/kurobbs.js';
import { formatNumber } from '../utils/format.js';
import { getTeamKey, getQualityInfo, formatScoreCompact, getMondayStart } from '../utils/format.js';
import { computeRankingGroups } from '../utils/modalData.js';
import { loadWarzone } from '../api/client.js';
import { DIFFICULTY_OPTIONS, getDifficultyLabel } from '../api/config.js';
import Modal from './Modals/Modal.jsx';
import { CurveChart } from './Modals/CurveModal.jsx';
import useMediaQuery, { MOBILE_QUERY } from '../hooks/useMediaQuery.js';
import { useTrendData } from '../hooks/useTrendData.js';

// 阶级字符串 → 榜单 rank 数字（1=B 2=A 3=S 4=SS 5=SSS 6=SSS+）
const GRADE_TO_RANK = { 'B': 1, 'A': 2, 'S': 3, 'SS': 4, 'SSS': 5, 'SSS+': 6 };
// 本周按时采样（多次同步的时间序列）
const TODAY_SAMPLES_KEY = 'my_wz_today_samples';
// 最近一次同步的本周数据（刷新后先显示本地，再异步更新）
const LAST_SYNC_KEY = 'my_wz_last_sync';

// 段位（组名 + 区间）→ 难度 ID（如 传奇 + 80-120 → 16）
function matchDifficulty(groupName, groupLevel) {
    const level = String(groupLevel || '').replace(/\s+/g, '');
    const opt = DIFFICULTY_OPTIONS.find(o =>
        o.label.split(' ')[0] === String(groupName || '') && level && o.label.includes(level)
    );
    return opt ? opt.value : '16';
}

const WZ_SCORE_KEY = 'my_wz_scores';
const PPC_SCORE_KEY = 'my_ppc_scores';
const KURO_AUTO_SYNC_KEY = 'kurobbs_auto_sync_time';
const KURO_AUTO_SYNC_INTERVAL = 10 * 1000; // 进入页面主动同步，10s 防抖（防快速连点）

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

// 三步使用引导（横向步骤条）
function SetupGuide({ loggedIn, kuroBound, weekSaved }) {
    const jump = anchor => {
        const el = document.getElementById(anchor);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    return (
        <div className="setup-guide">
            <div className="setup-guide-header">
                <div className="setup-guide-title">使用引导</div>
                <div className="setup-guide-sub">三步开启「分数一键同步 · 历史多端可查」</div>
            </div>
            <div className="guide-steps">
                <div className={`guide-step${loggedIn ? ' done' : ''}`} onClick={() => !loggedIn && jump('mine-account')}>
                    <div className="guide-step-dot">{loggedIn ? '✓' : '1'}</div>
                    <div className="guide-step-info">
                        <div className="guide-step-title">登录账号</div>
                        <div className="guide-step-desc">{loggedIn ? '已完成 · 云端同步开启' : '没有账号？一键注册'}</div>
                    </div>
                    {!loggedIn && <button className="guide-action">登录 / 注册</button>}
                </div>
                <div className={`guide-step${kuroBound ? ' done' : ''}`} onClick={() => !kuroBound && jump('mine-account')}>
                    <div className="guide-step-dot">{kuroBound ? '✓' : '2'}</div>
                    <div className="guide-step-info">
                        <div className="guide-step-title">绑定库街区</div>
                        <div className="guide-step-desc">{kuroBound ? '已完成 · 可同步分数' : '一键拉取游戏内分数'}</div>
                    </div>
                    {!kuroBound && <button className="guide-action">去绑定</button>}
                </div>
                <div className={`guide-step${weekSaved ? ' done' : ''}`} onClick={() => !weekSaved && jump('mine-scores')}>
                    <div className="guide-step-dot">{weekSaved ? '✓' : '3'}</div>
                    <div className="guide-step-info">
                        <div className="guide-step-title">保存本周分数</div>
                        <div className="guide-step-desc">{weekSaved ? '已完成 · 已备份云端' : '确认录入并保存'}</div>
                    </div>
                    {!weekSaved && <button className="guide-action">去录入</button>}
                </div>
            </div>
        </div>
    );
}

function ScoreTable({ rows, columns, renderCell, onDelete, groupCol, onTeam, renderTotalRank, tip }) {
    if (rows.length === 0) return null;
    const hasTeam = s => (s.zones || []).some(z => (z.team || []).length > 0);
    return (
        <>
            <div className="score-history-title">
                历史记录
                {tip && <span className="score-history-tip">{tip}</span>}
            </div>
            <div className="table-scroll">
                <table className="score-table">
                <thead>
                    <tr>
                        {groupCol && <th>段位</th>}
                        <th>周</th>
                        {columns.map((c, i) => <th key={i}>{c}</th>)}
                        <th>总分</th>
                        {onTeam && <th>阵容</th>}
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(s => (
                        <tr key={s.week}>
                            {groupCol && <td>{s.groupName || '-'}{s.groupLevel ? `(${s.groupLevel})` : ''}</td>}
                            <td>第{s.week}周</td>
                            {renderCell(s)}
                            <td className="score-total">
                                <span>{formatNumber(s.total)}</span>
                                {renderTotalRank && renderTotalRank(s)}
                            </td>
                            {onTeam && (
                                <td>
                                    {hasTeam(s) && (
                                        <button className="score-team-btn" onClick={() => onTeam(s)}>查看</button>
                                    )}
                                </td>
                            )}
                            <td><button className="score-delete" onClick={() => onDelete(s.week)}>删除</button></td>
                        </tr>
                    ))}
                </tbody>
            </table>
            </div>
        </>
    );
}

// 历史记录阵容弹窗（展示记录中保存的角色 + 阶级）
function HistoryTeamModal({ record, onClose }) {
    if (!record) return null;
    return (
        <Modal title={`第${record.week}周 阵容`} sub={record.groupName || ''} onClose={onClose}>
            <div className="history-team">
                {(record.zones || []).map((z, i) => (
                    <div className="history-team-zone" key={i}>
                        <div className="history-team-zone-head">
                            <span className="history-team-zone-name">{z.name}</span>
                            <span className="history-team-zone-score">{formatNumber(z.score)}</span>
                        </div>
                        <div className="history-team-chars">
                            {(z.team || []).map((t, k) => (
                                <span className="week-char" key={k}>
                                    {t.name || '?'}
                                    {t.grade && <em>{t.grade}</em>}
                                </span>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </Modal>
    );
}

// 删除确认弹窗
function DeleteConfirmModal({ pending, label, onConfirm, onClose }) {
    if (!pending) return null;
    return (
        <Modal title="删除记录" sub={label} onClose={onClose}>
            <div className="delete-confirm">
                <div className="delete-confirm-text">删除后不可恢复，确认删除这条历史记录？</div>
                <div className="delete-confirm-btns">
                    <button className="bind-set-btn" onClick={onClose}>取消</button>
                    <button className="delete-confirm-btn" onClick={() => { onConfirm(); onClose(); }}>确认删除</button>
                </div>
            </div>
        </Modal>
    );
}

// 分数趋势（今日按时 + 本周按天，三区 + 总分；缺失时段：首次同步前=0，之后延续最新）
// 数据用 useTrendData 稳定引用：只有同步发生（syncStamp）或区列表变化才重算，避免动画反复重播
// 手机端不直接展示：收进「本周分数」卡片的二级弹窗（WeekScoreCard 内趋势按钮打开）
function MyTrendSection({ zones, syncStamp }) {
    const isMobile = useMediaQuery(MOBILE_QUERY);
    const { todayData, dayData, hasToday, hasWeek, zoneList } = useTrendData(zones, syncStamp);
    if (isMobile) return null;

    return (
        <div className="trend-grid">
            <CurveChart title="今日按时趋势" data={todayData} zones={zoneList} mode="today" hasData={hasToday} showTotal />
            <CurveChart title="本周按天趋势（周一~周日）" data={dayData} zones={zoneList} mode="week" hasData={hasWeek} showTotal />
        </div>
    );
}

// 战区历史记录（本周分数由「本周分数」卡片展示）
function WzScoreSection({ zones, syncStamp, onChanged }) {
    const [scores, setScores] = useState(getScores(WZ_SCORE_KEY));
    const [pendingWeek, setPendingWeek] = useState(null);
    const [teamRecord, setTeamRecord] = useState(null);

    useEffect(() => { setScores(getScores(WZ_SCORE_KEY)); }, [syncStamp]);

    const del = week => {
        const next = getScores(WZ_SCORE_KEY).filter(s => s.week !== week);
        localStorage.setItem(WZ_SCORE_KEY, JSON.stringify(next));
        if (auth.isLoggedIn()) auth.syncToCloud('wz_scores', next);
        setScores(next);
        onChanged && onChanged();
    };

    if (zones.length === 0) return <div className="score-input-label">加载战区数据中…</div>;

    const latest = scores[0];
    const columns = latest ? latest.zones.map(z => z.name) : zones.map(z => z.name);
    const pending = scores.find(s => s.week === pendingWeek);

    return (
        <div className="mine-section">
            <div className="mine-section-header">
                <h3><span className="step-badge">2</span>我的战区</h3>
            </div>
            <MyTrendSection zones={zones} syncStamp={syncStamp} />
            {scores.length === 0 ? (
                <div className="score-empty">暂无历史记录 —— 同步本周分数后自动生成</div>
            ) : (
                <ScoreTable
                    rows={scores}
                    columns={columns}
                    groupCol
                    tip="区排名 #你的名次/同阵容总人数 · 总分旁为该段位总榜排名，未进前100显示晋级差距"
                    renderCell={s => s.zones.map((z, i) => (
                        <td key={i}>
                            <div className="score-cell">
                                <span>{formatNumber(z.score)}</span>
                                {(z.mech || z.monster || z.weather) && (
                                    <em className="score-cell-mech">
                                        {[z.mech, z.monster, z.weather].filter(Boolean).join(' · ')}
                                    </em>
                                )}
                                {z.teamRank
                                    ? <em className="score-cell-rank">#{z.teamRank.rank}/{z.teamRank.total}</em>
                                    : <em className="score-cell-rank off">未上榜</em>}
                            </div>
                        </td>
                    ))}
                    renderTotalRank={s => {
                        if (!s.totalRank) return <em className="score-total-rank off">未上榜</em>;
                        if (s.totalRank <= 100) {
                            return <em className="score-total-rank ok">全榜 #{s.totalRank}</em>;
                        }
                        return <em className="score-total-rank danger">+{formatNumber(s.totalDiff)} 进前100</em>;
                    }}
                    onDelete={setPendingWeek}
                    onTeam={setTeamRecord}
                />
            )}
            <DeleteConfirmModal
                pending={pendingWeek}
                label={pending ? `第${pending.week}周 · ${pending.groupName || '无段位'}` : ''}
                onConfirm={() => pendingWeek && del(pendingWeek)}
                onClose={() => setPendingWeek(null)}
            />
            <HistoryTeamModal record={teamRecord} onClose={() => setTeamRecord(null)} />
        </div>
    );
}

// 幻痛囚笼分数（同步即保存，仅展示 + 历史管理）
function PpcScoreSection({ bosses, currentWeek, onChanged, syncStamp }) {
    const [scores, setScores] = useState(getScores(PPC_SCORE_KEY));
    const [pendingWeek, setPendingWeek] = useState(null);

    useEffect(() => { setScores(getScores(PPC_SCORE_KEY)); }, [syncStamp]);

    const del = week => {
        const next = getScores(PPC_SCORE_KEY).filter(s => s.week !== week);
        localStorage.setItem(PPC_SCORE_KEY, JSON.stringify(next));
        if (auth.isLoggedIn()) auth.syncToCloud('ppc_scores', next);
        setScores(next);
        onChanged && onChanged();
    };

    if (bosses.length === 0) return <div className="score-input-label">加载幻痛数据中…</div>;

    const weekScore = scores.find(s => String(s.week) === String(currentWeek));
    const maxBosses = scores.length ? Math.max(...scores.map(s => s.bosses.length)) : bosses.length;
    const columns = Array.from({ length: maxBosses }, (_, i) => `Boss${i + 1}`);
    const pending = scores.find(s => s.week === pendingWeek);

    return (
        <div className="mine-section">
            <div className="mine-section-header">
                <h3><span className="step-badge">3</span>我的幻痛</h3>
                <span className="score-live-total">本周总分 <b>{formatNumber(weekScore ? weekScore.total : 0)}</b></span>
            </div>
            {weekScore ? (
                <div className="score-week-card">
                    <div className="score-week-zones">
                        {weekScore.bosses.map((b, i) => (
                            <span className="kuro-sync-item" key={i}>{b.name} {formatNumber(b.score)}</span>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="score-empty">本周暂无记录 —— 绑定库街区后自动同步</div>
            )}
            <ScoreTable
                rows={scores}
                columns={columns}
                renderCell={s => s.bosses.map((b, i) => <td key={i}>{formatNumber(b.score)}</td>)}
                onDelete={setPendingWeek}
            />
            <DeleteConfirmModal
                pending={pendingWeek}
                label={pending ? `第${pending.week}周` : ''}
                onConfirm={() => pendingWeek && del(pendingWeek)}
                onClose={() => setPendingWeek(null)}
            />
        </div>
    );
}
// 网站账号登录/注册
function WebLoginBlock({ onAuthChange }) {
    const [id, setId] = useState('');
    const [pw, setPw] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState('');
    const [user, setUser] = useState(null);
    const [showForgot, setShowForgot] = useState(false);

    useEffect(() => {
        auth.init().then(() => {
            const u = auth.isLoggedIn() ? { id: auth.playerId, name: auth.playerName } : null;
            setUser(u);
            onAuthChange && onAuthChange(u);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const doLogin = async () => {
        setError('');
        setBusy('登录中…');
        try {
            await auth.login(id.trim(), pw);
            const u = { id: auth.playerId, name: auth.playerName };
            setUser(u);
            onAuthChange && onAuthChange(u);
            setPw('');
        } catch (e) {
            setError(e.message);
        }
        setBusy('');
    };

    const doRegister = async () => {
        setError('');
        setBusy('注册中…');
        try {
            await auth.register(id.trim(), pw);
            const u = { id: auth.playerId, name: auth.playerName };
            setUser(u);
            onAuthChange && onAuthChange(u);
            setPw('');
        } catch (e) {
            setError(e.message);
        }
        setBusy('');
    };

    const doLogout = () => {
        auth.logout();
        setUser(null);
        onAuthChange && onAuthChange(null);
    };

    return (
        <div className="account-block">
            <div className="account-block-title">
                <span className="step-badge">1</span>
                网站账号
                <span className={`status-dot${user ? ' on' : ' off'}`} />
                <span className={`status-text${user ? ' on' : ' off'}`}>{user ? '已登录' : '未登录'}</span>
            </div>
            <div className="account-block-desc">登录后分数保存自动同步云端，换设备登录即可查看历史</div>
            {!user ? (
                <div className="account-form">
                    <div className="login-input-row">
                        <input className="login-input" placeholder="用户名（2-20位字母或数字）" value={id} onChange={e => setId(e.target.value)} />
                    </div>
                    <div className="login-input-row">
                        <input
                            className="login-input"
                            type="password"
                            placeholder="密码（6-20位）"
                            value={pw}
                            onChange={e => setPw(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') doLogin(); }}
                        />
                    </div>
                    <div className="login-btns">
                        <button className="bind-btn" disabled={!!busy} onClick={doLogin}>{busy || '登录'}</button>
                        <button className="bind-set-btn follow-set-btn" disabled={!!busy} onClick={doRegister}>注册</button>
                    </div>
                    <div className="login-links">
                        <button className="login-link" onClick={() => setShowForgot(true)}>忘记密码</button>
                    </div>
                    <div className="login-error">{error}</div>
                </div>
            ) : (
                <div className="logged-in-info" style={{ padding: 0 }}>
                    <div className="logged-in-user">
                        <div className="logged-in-name">{user.name || `ID: ${user.id}`}</div>
                        <div className="logged-in-id">{user.id}</div>
                    </div>
                    <div className="logged-in-status">已登录 · 数据云端同步</div>
                    <button className="bind-btn-unbind" onClick={doLogout}>退出登录</button>
                </div>
            )}
            <ForgotPasswordModal onClose={() => setShowForgot(false)} show={showForgot} />
        </div>
    );
}

// 库街区绑定 + 一键同步分数（支持云端恢复绑定）
function KuroBlock({ onSyncData, onBoundChange, authReady, authTick }) {
    const [phone, setPhone] = useState('');
    const [boundPhone, setBoundPhone] = useState(getKuroPhone());
    const [code, setCode] = useState('');
    const [countdown, setCountdown] = useState(0);
    const [token, setToken] = useState(getKuroToken());
    const [roles, setRoles] = useState([]);
    const [selRole, setSelRole] = useState(null);
    const [sync, setSync] = useState(null);
    const [busy, setBusy] = useState('');
    const [msg, setMsg] = useState('');
    const autoSyncedRef = useRef(false);

    const changeToken = t => {
        setToken(t);
        onBoundChange && onBoundChange(!!t);
    };

    // 登录状态变化：
    // 0. 退出账号：清除有归属的设备绑定（重新登录原账号会从云端恢复）
    // 1. 本地绑定属于其他账号 → 清除（防串号）
    // 2. 属于当前账号（或首次归属）→ 推送云端 + 恢复绑定
    useEffect(() => {
        const localToken = getKuroToken();
        const localPhone = getKuroPhone();
        const boundUser = localStorage.getItem('kurobbs_bound_user');
        const curUser = auth.isLoggedIn() ? auth.playerId : null;

        if (!curUser && boundUser && localToken) {
            clearKuroToken();
            clearKuroPhone();
            localStorage.removeItem('kurobbs_bound_user');
            setPhone('');
            setBoundPhone('');
            changeToken('');
            autoSyncedRef.current = false;
            return;
        }
        if (localToken && curUser && boundUser && boundUser !== curUser) {
            // 设备绑定属于其他账号：作废
            clearKuroToken();
            clearKuroPhone();
            localStorage.removeItem('kurobbs_bound_user');
            setPhone('');
            setBoundPhone('');
            changeToken('');
            setMsg('该设备的库街区绑定属于其他账号，已清除，请重新绑定');
            return;
        }
        if (curUser && localToken && localPhone) {
            if (!boundUser) localStorage.setItem('kurobbs_bound_user', curUser);
            auth.syncToCloud('kuro_token', localToken);
            auth.syncToCloud('kuro_phone', localPhone);
        }
        if (!token && localToken) {
            localStorage.removeItem(KURO_AUTO_SYNC_KEY);
            changeToken(localToken);
            if (localPhone) {
                setPhone(localPhone);
                setBoundPhone(localPhone);
            }
            setMsg('已自动恢复库街区绑定，正在同步…');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authReady, authTick]);

    // 拉取战区/囚笼数据并直接保存（auto=true 为自动同步，静默失败、成功记录时间）
    const fetchScores = async (auto = false) => {
        if (!token || !selRole) return false;
        try {
            const roleId = selRole.roleId;
            const serverId = selRole.serverId || '1000';
            const [area, ppc] = await Promise.all([
                getAreaData(token, roleId, serverId),
                getPrisonerCageData(token, roleId, serverId)
            ]);
            const zones = {};
            ((area || {}).areaInfo || {}).stageFightInfoList.forEach(s => {
                if (!s.stageName) return;
                const team = [];
                ((s.areaBuffFightInfoList) || []).forEach(bf => {
                    ((bf.bodyList) || []).forEach(bodyItem => {
                        const bodyInfo = (bodyItem.bodyInfo) || {};
                        const body = (bodyInfo.body) || {};
                        if (body.bodyName) team.push({ name: body.bodyName, grade: bodyInfo.grade || '', id: body.bodyId || '' });
                    });
                });
                zones[s.stageName] = { score: s.point, team };
            });
            const bosses = {};
            (((ppc || {}).prisonerCage || {}).bossFightInfoList || []).forEach(b => {
                const name = b.boss && b.boss.name;
                if (name && b.totalPoint) bosses[name] = b.totalPoint;
            });
            if (onSyncData) onSyncData({
                zones,
                bosses,
                area,
                ppc,
                roleId: selRole.roleId,
                serverId: selRole.serverId || '1000',
                groupName: (area || {}).groupName || '',
                groupLevel: (area || {}).groupLevel || '',
                challengeTimes: ((area || {}).areaInfo || {}).totalChallengeTimes || 0
            });
            localStorage.setItem(KURO_AUTO_SYNC_KEY, String(Date.now()));
            if (!auto) setMsg('已同步并保存本周分数');
            return true;
        } catch (e) {
            if (/过期|风险/.test(e.message)) {
                clearKuroToken();
                changeToken('');
            }
            if (!auto) setMsg(e.message);
            return false;
        }
    };

    // 进入页面主动同步：绑定 + 角色就绪即拉取（60s 防抖）
    useEffect(() => {
        if (!token || !selRole || autoSyncedRef.current) return;
        autoSyncedRef.current = true;
        const last = parseInt(localStorage.getItem(KURO_AUTO_SYNC_KEY) || '0', 10);
        if (Date.now() - last >= KURO_AUTO_SYNC_INTERVAL) {
            fetchScores(true).then(ok => {
                if (ok) setMsg('已自动同步并保存本周分数');
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token, selRole]);

    // 绑定 token 后自动拉取角色列表，默认选中第一个角色
    useEffect(() => {
        if (!token) {
            setRoles([]);
            setSelRole(null);
            return;
        }
        let cancelled = false;
        setBusy('正在获取角色…');
        getKuroRoleList(token).then(list => {
            if (cancelled) return;
            setRoles(list);
            setSelRole(list[0] || null);
            setBusy('');
        }).catch(e => {
            if (cancelled) return;
            setMsg(e.message);
            if (/过期|风险/.test(e.message)) {
                clearKuroToken();
                changeToken('');
            }
            setBusy('');
        });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    const sendCode = async () => {
        if (!/^1[3-9]\d{9}$/.test(phone)) return setMsg('请输入正确的11位手机号');
        setMsg('请完成滑块验证…');
        try {
            const geeTestData = await showGeetestCaptcha();
            setMsg('正在发送验证码…');
            await sendSmsCode(phone, geeTestData);
            setMsg('验证码已发送，请查收短信');
            let n = 60;
            setCountdown(n);
            const timer = setInterval(() => {
                n -= 1;
                if (n <= 0) { clearInterval(timer); setCountdown(0); } else setCountdown(n);
            }, 1000);
        } catch (e) {
            setMsg(e.message || '验证码发送失败');
        }
    };

    const doBind = async () => {
        if (!code.trim()) return setMsg('请输入短信验证码');
        setBusy('绑定中…');
        try {
            await kuroLogin(phone, code);
            setKuroPhone(phone);
            if (auth.isLoggedIn()) {
                localStorage.setItem('kurobbs_bound_user', auth.playerId);
                auth.syncToCloud('kuro_token', getKuroToken());
                auth.syncToCloud('kuro_phone', phone);
            }
            changeToken(getKuroToken());
            setCode('');
            setMsg('绑定成功，正在获取角色…');
        } catch (e) {
            setMsg(e.message || '绑定失败');
        }
        setBusy('');
    };

    const doSync = () => {
        setBusy('同步分数中…');
        fetchScores(false).finally(() => setBusy(''));
    };

    const doUnbind = () => {
        clearKuroToken();
        clearKuroPhone();
        localStorage.removeItem('kurobbs_bound_user');
        setBoundPhone('');
        if (auth.isLoggedIn()) {
            auth.removeCloud('kuro_token');
            auth.removeCloud('kuro_phone');
        }
        changeToken('');
        autoSyncedRef.current = false;
        setMsg('已解绑库街区');
    };

    const area = sync && sync.area;
    const areaInfo = (area || {}).areaInfo || {};
    const ppc = sync && sync.ppc;
    const ppcInfo = ((ppc || {}).prisonerCage) || {};

    return (
        <div className="account-block">
            <div className="account-block-title">
                <span className="step-badge">2</span>
                库街区
                <span className={`status-dot${token ? ' on' : ' off'}`} />
                <span className={`status-text${token ? ' on' : ' off'}`}>{token ? '已绑定' : '未绑定'}</span>
            </div>
            <div className="account-block-desc">绑定后每周点「同步分数」，一键拉取游戏内战区 / 幻痛数据</div>
            {!token ? (
                <div className="account-form">
                    {boundPhone && (
                        <div className="kuro-bound-hint">
                            该账号已绑定 {boundPhone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')}，收验证码即可重新验证（如需换绑请修改手机号）
                        </div>
                    )}
                    <div className="login-input-row">
                        <input
                            className="login-input"
                            type="tel"
                            maxLength="11"
                            placeholder="库街区手机号"
                            value={phone}
                            onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                        />
                    </div>
                    <div className="login-input-row">
                        <input
                            className="login-input"
                            type="text"
                            maxLength="6"
                            placeholder="短信验证码"
                            value={code}
                            onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                            onKeyDown={e => { if (e.key === 'Enter') doBind(); }}
                        />
                        <button className="code-btn" disabled={countdown > 0} onClick={sendCode}>
                            {countdown > 0 ? `${countdown}秒` : '获取验证码'}
                        </button>
                    </div>
                    <div className="login-btns">
                        <button className="bind-btn" disabled={!!busy} onClick={doBind}>{busy || '绑定登录'}</button>
                    </div>
                </div>
            ) : (
                <>
                    <div className="logged-in-info" style={{ padding: 0 }}>
                        <div className="logged-in-user">
                            <div className="logged-in-name">库街区已绑定</div>
                            <div className="logged-in-id">{selRole ? `${selRole.roleName || '未知角色'} · ${selRole.serverName || ''}` : (busy || '获取角色中…')}</div>
                        </div>
                        <div className="data-mgmt-btns" style={{ marginTop: 6, justifyContent: 'center' }}>
                            {roles.length > 1 && (
                                <select
                                    className="bind-input"
                                    style={{ maxWidth: 200 }}
                                    value={selRole ? String(selRole.roleId) : ''}
                                    onChange={e => setSelRole(roles.find(r => String(r.roleId) === e.target.value) || null)}
                                >
                                    {roles.map(r => (
                                        <option key={r.roleId} value={String(r.roleId)}>
                                            {r.roleName || '未知'}（{r.serverName || '?'}）
                                        </option>
                                    ))}
                                </select>
                            )}
                            <button className="bind-btn" disabled={!!busy} onClick={doSync}>{busy || '同步分数'}</button>
                        </div>
                    </div>
                    <div className="data-mgmt-btns" style={{ marginTop: 10, justifyContent: 'center' }}>
                        <button className="bind-btn-unbind" onClick={doUnbind}>解绑库街区</button>
                    </div>
                </>
            )}
            {msg && <div className="data-mgmt-msg">{msg}</div>}
        </div>
    );
}

// 阵容详情二级弹窗（角色/阶级/元素/职业/武器/辅助机/芯片）
function TeamDetailModal({ stage, onClose }) {
    if (!stage) return null;
    return (
        <Modal
            title={stage.stageName}
            sub={`${stage.description ? stage.description + ' · ' : ''}积分 ${formatNumber(stage.point || 0)} · 波次 ${stage.npcGroup || 0} · 挑战 ${stage.totalNum || 0} 次`}
            onClose={onClose}
            wide
        >
            <div className="team-detail">
                {(stage.areaBuffFightInfoList || []).map((bf, j) => (
                    <div className="team-detail-buff" key={j}>
                        <div className="team-detail-buff-head">
                            <span className="team-detail-buff-name">{bf.buffName || 'Buff'}</span>
                            <span className="team-detail-buff-point">积分 {formatNumber(bf.point || 0)}</span>
                            {bf.fightTime ? <span className="team-detail-buff-time">耗时 {bf.fightTime}s</span> : null}
                        </div>
                        <div className="team-detail-chars">
                            {(bf.bodyList || []).map((bodyItem, k) => {
                                const bodyInfo = bodyItem.bodyInfo || {};
                                const body = bodyInfo.body || {};
                                const weaponInfo = bodyItem.weaponInfo || {};
                                const weapon = weaponInfo.weapon || {};
                                const partner = bodyItem.partnerInfo || {};
                                return (
                                    <div className="team-detail-char" key={k}>
                                        <div className="team-detail-char-head">
                                            {body.iconUrl && <img className="team-detail-avatar" src={body.iconUrl} alt="" loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                                            <div>
                                                <div className="team-detail-char-name">{body.bodyName || '?'}<em>{bodyInfo.grade || ''}</em></div>
                                                <div className="team-detail-char-sub">{body.roleName || ''} · {body.career || ''} · {body.element || ''}</div>
                                            </div>
                                        </div>
                                        <div className="team-detail-rows">
                                            {weapon.name && <div className="team-detail-row">武器：{weapon.name}{weaponInfo.overRunLevel ? `（超频${weaponInfo.overRunLevel}）` : ''}</div>}
                                            {partner.name && <div className="team-detail-row">辅助机：{partner.name}{partner.gradeStr ? `（${partner.gradeStr}）` : ''}</div>}
                                            {(bodyItem.chipSuitInfoList || []).length > 0 && (
                                                <div className="team-detail-row">芯片：{(bodyItem.chipSuitInfoList || []).map(c => `${c.name}${c.num || ''}`).join(' · ')}</div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </Modal>
    );
}

// 我的阵容 vs 榜单对比弹窗（按段位自动匹配难度，可切换，核心=同阵容组内完整对比）
function MyRankCompareModal({ stage, myGroupName, myGroupLevel, roleId, serverId, onClose }) {
    const [difficulty, setDifficulty] = useState(() => matchDifficulty(myGroupName, myGroupLevel));
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [abilityMap, setAbilityMap] = useState({});
    const listRef = useRef(null);
    const mineRef = useRef(null);

    const scrollToMine = () => {
        if (mineRef.current) {
            mineRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    };

    // 按难度加载榜单数据（内存缓存 60s）
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        loadWarzone(difficulty, null).then(res => {
            if (cancelled) return;
            setData({ rankings: res.rankings || [], zones: (res.warzone && res.warzone.area && res.warzone.area.zones) || [] });
            setLoading(false);
        }).catch(() => {
            if (!cancelled) { setLoading(false); setData(null); }
        });
        return () => { cancelled = true; };
    }, [difficulty]);

    // 拉取我的角色战力（roleIndex.fightAbility）
    useEffect(() => {
        const token = getKuroToken();
        if (!token || !roleId) return;
        let cancelled = false;
        getRoleIndexData(token, roleId, serverId || '1000').then(res => {
            if (cancelled) return;
            const map = {};
            ((res || {}).characterList || []).forEach(c => {
                if (c.bodyId != null) map[String(c.bodyId)] = c.fightAbility || 0;
            });
            setAbilityMap(map);
        }).catch(() => { /* 战力拉取失败不阻断 */ });
        return () => { cancelled = true; };
    }, []);

    if (!stage) return null;

    const rankings = data ? data.rankings : [];
    const zones = data ? data.zones : [];
    const zone = zones.find(z => z.name === stage.stageName);
    const myScore = stage.point || 0;

    // 我的阵容（角色 bodyId + 阶级→rank 数字 + 头像）
    const myChars = [];
    ((stage.areaBuffFightInfoList) || []).forEach(bf => {
        ((bf.bodyList) || []).forEach(bodyItem => {
            const bodyInfo = bodyItem.bodyInfo || {};
            const body = bodyInfo.body || {};
            if (body.bodyName) {
                myChars.push({
                    id: body.bodyId || body.bodyName,
                    characterName: body.bodyName,
                    rank: GRADE_TO_RANK[bodyInfo.grade] || 0,
                    icon: body.iconUrl || ''
                });
            }
        });
    });
    const myKey = getTeamKey(myChars);

    // 该难度下榜单该区所有分数（降序）
    const zoneScores = rankings
        .map(r => (r.zones || []).find(z => zone && z.id === zone.id))
        .filter(zd => zd && zd.score > 0)
        .map(zd => zd.score)
        .sort((a, b) => b - a);

    const myRank = myScore > 0 ? zoneScores.filter(s => s > myScore).length + 1 : 0;
    const totalOnBoard = zoneScores.length;
    const gate100 = totalOnBoard >= 100 ? zoneScores[99] : (totalOnBoard > 0 ? zoneScores[totalOnBoard - 1] : 0);
    const diff100 = myScore > 0 && gate100 > 0 ? gate100 - myScore : 0;

    // 同阵容组（阵容排行核心：同阵容独立排名）
    let myGroup = null;
    let myGroupRank = 0;
    let mergedPlayers = [];
    if (zone && myChars.length > 0) {
        const teams = computeRankingGroups(rankings, zone.id, '');
        myGroup = teams.find(t => getTeamKey(t.chars) === myKey) || null;
        if (myGroup) {
            // 把我一并插入同阵容榜单（分数+战力），按分数排序
            mergedPlayers = [
                ...myGroup.players,
                {
                    id: 'mine',
                    name: '我',
                    portrait: '',
                    score: myScore,
                    chars: myChars.map(c => ({
                        characterName: c.characterName,
                        rank: c.rank,
                        bp: abilityMap[String(c.id)] || 0,
                        icon: c.icon
                    })),
                    mine: true
                }
            ]
                .filter(p => p.score > 0)
                .sort((a, b) => b.score - a.score);
            myGroupRank = mergedPlayers.findIndex(p => p.mine) + 1;
        }
    }

    // 难度切换（同段位组内上下移动：如 传奇80-120 只有 16，则跳到相邻段位组）
    const curIdx = DIFFICULTY_OPTIONS.findIndex(o => o.value === String(difficulty));
    const canUp = curIdx > 0;
    const canDown = curIdx < DIFFICULTY_OPTIONS.length - 1;
    const isMyTier = matchDifficulty(myGroupName, myGroupLevel) === String(difficulty);

    return (
        <Modal title={stage.stageName} sub={`我的分数 ${formatNumber(myScore)} · 阵容对比`} onClose={onClose} wide>
            <div className="rank-compare">
                <div className="rank-compare-head">
                    <div className="rank-compare-diff">
                        <button className="rank-compare-switch" disabled={!canUp} onClick={() => canUp && setDifficulty(DIFFICULTY_OPTIONS[curIdx - 1].value)}>↑ 更高</button>
                        <span className={`rank-compare-diff-label${isMyTier ? ' mine' : ''}`}>
                            {getDifficultyLabel(difficulty)}
                            {isMyTier ? '（我的段位）' : ''}
                        </span>
                        <button className="rank-compare-switch" disabled={!canDown} onClick={() => canDown && setDifficulty(DIFFICULTY_OPTIONS[curIdx + 1].value)}>更低 ↓</button>
                    </div>
                </div>

                {loading ? (
                    <div className="score-input-label">加载榜单中…</div>
                ) : !data ? (
                    <div className="rank-compare-note">榜单加载失败，请稍后重试</div>
                ) : (
                    <>
                        <div className="rank-compare-stats">
                            <div className="rank-compare-stat">
                                <span className="rank-compare-num">{myGroupRank > 0 ? `#${myGroupRank}` : '--'}</span>
                                <span className="rank-compare-label">同阵容榜单（共 {mergedPlayers.length} 人）</span>
                            </div>
                            <div className="rank-compare-stat">
                                <span className="rank-compare-num">{formatNumber(gate100)}</span>
                                <span className="rank-compare-label">该段位前100门槛</span>
                            </div>
                            <div className="rank-compare-stat">
                                <span className={`rank-compare-num${diff100 > 0 ? ' danger' : ' ok'}`}>
                                    {diff100 > 0 ? `+${formatNumber(diff100)}` : myScore > 0 ? '已晋级' : '--'}
                                </span>
                                <span className="rank-compare-label">{diff100 > 0 ? '晋级前100还差' : '晋级状态'}</span>
                            </div>
                        </div>
                        <div className="rank-compare-note">
                            对比榜单仅收录排行榜前 100 出现过的阵容组合（共 {totalOnBoard} 人上榜）
                        </div>

                        <div className="rank-compare-team">
                            <div className="rank-compare-team-title">我的阵容</div>
                            <div className="history-team-chars">
                                {myChars.map((c, i) => (
                                    <span className="week-char" key={i}>
                                        {c.characterName || '?'}
                                        {c.rank > 0 && <em>{getQualityInfo(c.rank)}</em>}
                                        {abilityMap[String(c.id)] > 0 && <b className="week-char-bp">{formatScoreCompact(abilityMap[String(c.id)])}</b>}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {myGroup ? (
                            <div className="rank-compare-team">
                                <div className="rank-compare-team-title">
                                    同阵容排名 <span className="rank-compare-group-rank">#{myGroupRank} / {myGroup.players.length} 人</span>
                                    {myGroupRank > 0 && (
                                        <button className="rank-compare-jump" onClick={scrollToMine}>定位我的排名</button>
                                    )}
                                </div>
                                <div className="rank-compare-group-info">
                                    <span>组内最高 <b>{formatNumber(myGroup.players[0].score)}</b></span>
                                    {myScore > 0 && (
                                        <span className={myGroup.players[0].score - myScore > 0 ? 'rank-compare-worse' : 'rank-compare-better'}>
                                            {myGroup.players[0].score - myScore > 0 ? `比最高分少 ${formatNumber(myGroup.players[0].score - myScore)}` : '已达组内最高'}
                                        </span>
                                    )}
                                </div>
                                <div className="team-rank-list" ref={listRef}>
                                    {mergedPlayers.map((p, i) => (
                                        <div
                                            className={`team-rank-item${p.mine ? ' mine-row' : ''}`}
                                            key={p.id}
                                            ref={p.mine ? mineRef : undefined}
                                        >
                                            <span className={`team-rank-pos${i < 3 ? ` team-rank-pos-top${i + 1}` : ''}`}>{i + 1}</span>
                                            {p.portrait && <img className="team-rank-avatar" src={getImageUrl(p.portrait)} alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                                            <div className="team-rank-info">
                                                <span className={`team-rank-name${p.mine ? ' mine-name' : ''}`}>{p.mine ? '我' : p.name}</span>
                                                <div className="team-rank-chars">
                                                    {p.chars.map((c, j) => (
                                                        <span className="team-rank-char" key={j}>
                                                            {c.icon && <img className="team-rank-char-icon" src={String(c.icon).startsWith('http') ? c.icon : getImageUrl(c.icon)} alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                                                            <span className="team-rank-char-name">{c.characterName}</span>
                                                            {c.rank > 0 && <em className="team-rank-char-rank">{getQualityInfo(c.rank)}</em>}
                                                            <span className="team-rank-bp">{c.bp ? formatScoreCompact(c.bp) : '--'}</span>
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                            <span className="team-rank-score">{formatNumber(p.score)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="rank-compare-note">
                                该难度下未找到我的阵容组合——可以切换「更高/更低」段位查看
                            </div>
                        )}

                        {diff100 > 0 && (
                            <div className="rank-compare-tip">
                                提示：战双三区都需要高练度阵容，单区练度高无法进前 100。提升{zone ? '该区' : '各区'}练度（阶级/武器/共鸣）是关键
                            </div>
                        )}
                    </>
                )}
            </div>
        </Modal>
    );
}

// 本周分数卡片（同步结果独立展示，阵容在二级弹窗）
function WeekScoreCard({ area, ppc, roleId, serverId, trend, showTrendBtn }) {
    const [activeStage, setActiveStage] = useState(null);
    const [compareStage, setCompareStage] = useState(null);
    const [showTrend, setShowTrend] = useState(false);
    if (!area && !ppc) return null;
    const areaInfo = (area || {}).areaInfo || {};
    const ppcInfo = ((ppc || {}).prisonerCage) || {};
    const areaEv = evaluateWzScore(areaInfo.totalPoint || 0);
    const myGroupName = (area || {}).groupName || '';
    const myGroupLevel = (area || {}).groupLevel || '';

    return (
        <div className="mine-section week-score-card">
            <div className="mine-section-header">
                <h3>本周分数</h3>
                {showTrendBtn && trend && (
                    <button className="week-trend-btn" onClick={() => setShowTrend(true)}>趋势</button>
                )}
            </div>
            <div className="week-card-grid">
                {area && (
                    <div className="week-card-block">
                        <div className="week-card-title">
                            纷争战区
                            {area.groupName && <span className="week-card-group">{area.groupName}{area.groupLevel ? `（${area.groupLevel}）` : ''}</span>}
                        </div>
                        <div className="week-card-stats">
                            <div className="week-stat">
                                <span className="week-stat-num">{formatNumber(areaInfo.totalPoint || 0)}</span>
                                <span className="week-stat-label">总分</span>
                            </div>
                            <div className="week-stat">
                                <span className="week-stat-num">{areaInfo.totalChallengeTimes || 0}</span>
                                <span className="week-stat-label">挑战次数</span>
                            </div>
                            <div className={`eval-tag eval-level-${areaEv.level}`}>{areaEv.text}</div>
                        </div>
                        <div className="week-zones">
                            {(areaInfo.stageFightInfoList || []).map((s, i) => (
                                <div className="week-zone" key={i}>
                                    <div className="week-zone-head">
                                        <div className="week-zone-top">
                                            <span className="week-zone-name">{s.stageName}</span>
                                            {s.description ? <span className="week-zone-mech">{s.description}</span> : null}
                                            <span className="week-zone-score">{formatNumber(s.point || 0)}</span>
                                        </div>
                                        <div className="week-zone-foot">
                                            <div className="week-zone-tags">
                                                {s.totalNum ? <span className="week-zone-wave">挑战 {s.totalNum} 次</span> : null}
                                                {s.npcGroup ? <span className="week-zone-wave">波次 {s.npcGroup}</span> : null}
                                            </div>
                                            {(s.areaBuffFightInfoList || []).length > 0 && (
                                                <button className="week-team-btn" onClick={() => setActiveStage(s)}>阵容</button>
                                            )}
                                            <button className="week-team-btn week-compare-btn" onClick={() => setCompareStage(s)}>对比榜单</button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {ppc && (
                    <div className="week-card-block">
                        <div className="week-card-title">幻痛囚笼</div>
                        <div className="week-card-stats">
                            <div className="week-stat">
                                <span className="week-stat-num">{formatNumber(ppcInfo.totalPoint || 0)}</span>
                                <span className="week-stat-label">总分</span>
                            </div>
                            <div className="week-stat">
                                <span className="week-stat-num">{ppcInfo.totalChallengeTimes || 0}</span>
                                <span className="week-stat-label">挑战次数</span>
                            </div>
                        </div>
                        <div className="week-zones">
                            {(ppcInfo.bossFightInfoList || []).map((b, i) => (
                                <div className="week-zone" key={i}>
                                    <div className="week-zone-head">
                                        <div className="week-zone-top">
                                            <span className="week-zone-name">{(b.boss && b.boss.name) || `Boss${i + 1}`}</span>
                                            <span className="week-zone-score">{formatNumber(b.totalPoint || 0)}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            <TeamDetailModal stage={activeStage} onClose={() => setActiveStage(null)} />
            <MyRankCompareModal
                stage={compareStage}
                myGroupName={myGroupName}
                myGroupLevel={myGroupLevel}
                roleId={roleId}
                serverId={serverId}
                onClose={() => setCompareStage(null)}
            />
            {showTrend && trend && (
                <Modal title="本周分数趋势" onClose={() => setShowTrend(false)}>
                    <div className="trend-grid trend-modal-grid">
                        <CurveChart title="今日按时趋势" data={trend.todayData} zones={trend.zoneList} mode="today" hasData={trend.hasToday} showTotal compact />
                        <CurveChart title="本周按天趋势（周一~周日）" data={trend.dayData} zones={trend.zoneList} mode="week" hasData={trend.hasWeek} showTotal compact />
                    </div>
                </Modal>
            )}
        </div>
    );
}

// 账号卡片：左网站账号，右库街区，底部说明
function AccountSection({ onSyncData, onAuthChange, onBoundChange, authReady, authTick }) {
    return (
        <div className="mine-section" id="mine-account">
            <div className="mine-section-header"><h3><span className="step-badge">1</span>账号 · 库街区</h3></div>
            <div className="account-grid">
                <WebLoginBlock onAuthChange={onAuthChange} />
                <KuroBlock onSyncData={onSyncData} onBoundChange={onBoundChange} authReady={authReady} authTick={authTick} />
            </div>
            <div className="account-intro">
                <span>· 登录网站账号：分数保存自动同步云端，换设备登录即可查看历史</span>
                <span>· 绑定库街区：每周点「同步分数」，一键拉取游戏内战区/幻痛数据</span>
            </div>
        </div>
    );
}
// 忘记密码弹窗（库街区验证码验证身份 → 重置；手机号脱敏展示，发码走后端）
function ForgotPasswordModal({ show, onClose }) {
    const [username, setUsername] = useState('');
    const [phoneMasked, setPhoneMasked] = useState('');
    const [code, setCode] = useState('');
    const [newPw, setNewPw] = useState('');
    const [countdown, setCountdown] = useState(0);
    const [busy, setBusy] = useState('');
    const [msg, setMsg] = useState('');

    if (!show) return null;
    const step = phoneMasked ? 1 : 0;

    const lookUp = async () => {
        setMsg('');
        setBusy('查询中…');
        try {
            const masked = await auth.getResetPhone(username.trim());
            setPhoneMasked(masked);
            setMsg(`该账号已绑定库街区 ${masked}`);
        } catch (e) {
            setMsg(e.message);
        }
        setBusy('');
    };

    const sendCode = async () => {
        setMsg('请完成滑块验证…');
        try {
            const geeTestData = await showGeetestCaptcha();
            setMsg('正在发送验证码…');
            await auth.sendResetCode(username.trim(), geeTestData);
            setMsg('验证码已发送，请查收短信');
            let n = 60;
            setCountdown(n);
            const timer = setInterval(() => {
                n -= 1;
                if (n <= 0) { clearInterval(timer); setCountdown(0); } else setCountdown(n);
            }, 1000);
        } catch (e) {
            setMsg(e.message || '验证码发送失败');
        }
    };

    const doReset = async () => {
        setMsg('');
        if (!code.trim()) return setMsg('请输入短信验证码');
        if (!/^.{6,20}$/.test(newPw)) return setMsg('新密码需为6-20位');
        setBusy('重置中…');
        try {
            await auth.resetPassword(username.trim(), code.trim(), newPw);
            setMsg('密码已重置，请重新登录');
            setTimeout(() => onClose(), 1500);
        } catch (e) {
            setMsg(e.message);
        }
        setBusy('');
    };

    return (
        <Modal title="找回密码" sub="通过库街区短信验证码验证身份" onClose={onClose}>
            <div className="forgot-form">
                <div className="login-input-row">
                    <input className="login-input" placeholder="用户名" value={username} onChange={e => setUsername(e.target.value)} disabled={step === 1} />
                </div>
                {step === 0 ? (
                    <div className="login-btns">
                        <button className="bind-btn" disabled={!!busy} onClick={lookUp}>{busy || '下一步'}</button>
                    </div>
                ) : (
                    <>
                        <div className="login-input-row">
                            <input className="login-input" type="text" maxLength="6" placeholder="短信验证码" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} />
                            <button className="code-btn" disabled={countdown > 0} onClick={sendCode}>
                                {countdown > 0 ? `${countdown}秒` : '获取验证码'}
                            </button>
                        </div>
                        <div className="login-input-row">
                            <input className="login-input" type="password" placeholder="新密码（6-20位）" value={newPw} onChange={e => setNewPw(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') doReset(); }} />
                        </div>
                        <div className="login-btns">
                            <button className="bind-btn" disabled={!!busy} onClick={doReset}>{busy || '重置密码'}</button>
                        </div>
                    </>
                )}
                {msg && <div className="login-hint">{msg}</div>}
            </div>
        </Modal>
    );
}

// 我的页面（引导 / 登录 / 同步 / 分数录入 / 关注 / 数据管理）
export default function MinePage() {
    const [follows, setFollows] = useState(getFollows());
    const [wzZones, setWzZones] = useState([]);
    const [ppcBosses, setPpcBosses] = useState([]);
    const [wzWeek, setWzWeek] = useState(null);
    const [ppcWeek, setPpcWeek] = useState(null);
    const [syncStamp, setSyncStamp] = useState(0);
    const [syncData, setSyncData] = useState(() => {
        try { return JSON.parse(localStorage.getItem(LAST_SYNC_KEY)) || null; } catch { return null; }
    });
    const [user, setUser] = useState(null);
    const [authReady, setAuthReady] = useState(false);
    const [authTick, setAuthTick] = useState(0);
    const [kuroBound, setKuroBound] = useState(!!getKuroToken());
    const [weekSaved, setWeekSaved] = useState(false);

    // 同步即保存：库街区同步成功后直接写入本周记录（本地 + 云端）
    // 同时按段位拉取榜单，计算各区「同阵容同阶级」排名存入历史
    const saveSyncedScores = async data => {
        if (!data) {
            setSyncData(null);
            localStorage.removeItem(LAST_SYNC_KEY);
            return;
        }
        const { zones, bosses, groupName, groupLevel, challengeTimes } = data;
        if (zones && wzWeek && Object.keys(zones).length) {
            let zoneScores = Object.entries(zones).map(([name, v]) =>
                typeof v === 'number' ? { name, score: v, team: [] } : { name, score: v.score, team: v.team || [] }
            );
            const total = zoneScores.reduce((a, z) => a + z.score, 0);

            // 同阵容排名（按段位匹配难度，异步）
            let totalRank = 0;
            let totalDiff = 0;
            try {
                const diff = matchDifficulty(groupName, groupLevel);
                const wz = await loadWarzone(diff, null);
                const fullZones = (wz.warzone && wz.warzone.area && wz.warzone.area.zones) || [];
                zoneScores = zoneScores.map(z => {
                    const full = fullZones.find(f => f.name === z.name);
                    if (!full) return z;
                    // 目标周机制标签：机制名（描述冒号前）+ 怪数量 + 首个天气（供历史记录渲染）
                    const desc = full.description || '';
                    const mech = desc.split('：')[0].split(':')[0];
                    const monster = desc.includes('单体') ? '单怪' : desc.includes('双体') ? '双怪' : desc.includes('群体') ? '群怪' : '';
                    const weather = (full.weathers && full.weathers[0]) ? full.weathers[0].name : '';
                    const tagged = { ...z, mech, monster, weather };
                    if (!z.team || z.team.length === 0) return tagged;
                    const myChars = z.team.map(t => ({ id: t.id || t.name, rank: GRADE_TO_RANK[t.grade] || 0 }));
                    const myKey = getTeamKey(myChars);
                    const teams = computeRankingGroups(wz.rankings || [], full.id, '');
                    const group = teams.find(t => getTeamKey(t.chars) === myKey);
                    if (!group) return tagged;
                    const rank = group.players.filter(p => p.score > z.score).length + 1;
                    return { ...tagged, teamRank: { rank, total: group.players.length } };
                });
                // 总榜排名 + 晋级前100差距
                const totalScores = (wz.rankings || []).map(r => r.score || 0).filter(s => s > 0).sort((a, b) => b - a);
                totalRank = totalScores.filter(s => s > total).length + 1;
                const gate = totalScores.length >= 100 ? totalScores[99] : (totalScores.length ? totalScores[totalScores.length - 1] : 0);
                totalDiff = gate > 0 ? gate - total : 0;
            } catch { /* 排名计算失败不影响保存 */ }

            let all = getScores(WZ_SCORE_KEY);
            all = all.filter(s => String(s.week) !== String(wzWeek));
            all.unshift({
                week: wzWeek,
                groupName: groupName || '',
                groupLevel: groupLevel || '',
                challengeTimes: challengeTimes || 0,
                zones: zoneScores,
                total,
                totalRank: totalRank > 0 ? totalRank : 0,
                totalDiff: totalDiff > 0 ? totalDiff : 0,
                timestamp: Date.now()
            });
            localStorage.setItem(WZ_SCORE_KEY, JSON.stringify(all.slice(0, 20)));
            if (auth.isLoggedIn()) auth.syncToCloud('wz_scores', all.slice(0, 20));

            // 本周按时采样（换周清理，分数未变不重复）
            try {
                let today = JSON.parse(localStorage.getItem(TODAY_SAMPLES_KEY)) || [];
                const monday = getMondayStart();
                today = today.filter(s => s.t >= monday);
                const sample = { t: Date.now(), zones: zoneScores.map(z => z.score), total };
                const lastS = today[today.length - 1];
                if (!lastS || lastS.total !== sample.total || JSON.stringify(lastS.zones) !== JSON.stringify(sample.zones)) {
                    today.push(sample);
                    localStorage.setItem(TODAY_SAMPLES_KEY, JSON.stringify(today.slice(-50)));
                }
            } catch { /* 采样失败忽略 */ }
        }
        if (bosses && ppcWeek && Object.keys(bosses).length) {
            const bossScores = Object.entries(bosses).map(([name, score]) => ({ name, score }));
            const total = bossScores.reduce((a, b) => a + b.score, 0);
            let all = getScores(PPC_SCORE_KEY);
            all = all.filter(s => String(s.week) !== String(ppcWeek));
            all.unshift({ week: ppcWeek, bosses: bossScores, total, timestamp: Date.now() });
            localStorage.setItem(PPC_SCORE_KEY, JSON.stringify(all.slice(0, 20)));
            if (auth.isLoggedIn()) auth.syncToCloud('ppc_scores', all.slice(0, 20));
        }
        setWeekSaved(true);
        setSyncStamp(n => n + 1);
        const lastSync = { area: data.area, ppc: data.ppc, roleId: data.roleId, serverId: data.serverId };
        setSyncData(lastSync);
        try { localStorage.setItem(LAST_SYNC_KEY, JSON.stringify(lastSync)); } catch { /* 本地缓存失败忽略 */ }
    };

    useEffect(() => {
        auth.init().then(() => {
            setUser(auth.isLoggedIn() ? { id: auth.playerId, name: auth.playerName } : null);
            setAuthReady(true);
        });
    }, []);

    // 计算"本周分数是否已保存"（供引导卡状态显示）
    useEffect(() => {
        if (!wzWeek) return;
        const scores = getScores(WZ_SCORE_KEY);
        setWeekSaved(scores.some(s => String(s.week) === String(wzWeek)));
    }, [wzWeek]);

    // 轻量加载当前战区/幻痛数据（区名/怪名）；走内存缓存避免重复请求
    useEffect(() => {
        (async () => {
            try {
                const result = await fetchJson(`${API_CONFIG.warzone}/current/16`);
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
                const result = await fetchJson(`${API_CONFIG.ppc}/current/4?ranking=true`);
                if (result.data && result.data.ppc) {
                    setPpcWeek(result.data.ppc.activity);
                    setPpcBosses((result.data.ppc.bosses || []).map(b => ({ name: b.name })));
                }
            } catch { /* 忽略 */ }
        })();
    }, []);

    const clearFollows = () => {
        if (confirm('确定清空关注？')) {
            saveFollows([]);
            setFollows([]);
        }
    };

    const isMobile = useMediaQuery(MOBILE_QUERY);
    const trend = useTrendData(wzZones, syncStamp);

    const removeFollow = id => {
        const next = follows.filter(f => String(f.id) !== String(id));
        saveFollows(next);
        setFollows(next);
    };

    return (
        <div>
            <SetupGuide loggedIn={!!user} kuroBound={kuroBound} weekSaved={weekSaved} />

            <AccountSection
                onSyncData={saveSyncedScores}
                onAuthChange={u => { setUser(u); setAuthTick(t => t + 1); }}
                onBoundChange={setKuroBound}
                authReady={authReady}
                authTick={authTick}
            />

            <WeekScoreCard
                area={syncData ? syncData.area : null}
                ppc={syncData ? syncData.ppc : null}
                roleId={syncData ? syncData.roleId : null}
                serverId={syncData ? syncData.serverId : null}
                trend={trend}
                showTrendBtn={isMobile}
            />

            <div id="mine-scores">
                <WzScoreSection zones={wzZones} syncStamp={syncStamp} onChanged={() => setWeekSaved(getScores(WZ_SCORE_KEY).some(s => String(s.week) === String(wzWeek)))} />
                <PpcScoreSection bosses={ppcBosses} currentWeek={ppcWeek} syncStamp={syncStamp} onChanged={() => setWeekSaved(getScores(WZ_SCORE_KEY).some(s => String(s.week) === String(wzWeek)))} />
            </div>

            <div className="mine-section">
                <div className="mine-section-header">
                    <h3><span className="step-badge">4</span>关注列表</h3>
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
        </div>
    );
}
