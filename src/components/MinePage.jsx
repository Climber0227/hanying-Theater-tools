import React, { useEffect, useMemo, useRef, useState } from 'react';
import { fetchJson } from '../api/client.js';
import { API_CONFIG, getImageUrl } from '../api/config.js';
import { getFollows, saveFollows } from '../api/storage.js';
import { auth } from '../api/auth.js';
import {
    getKuroToken, clearKuroToken,
    getKuroPhone, setKuroPhone, clearKuroPhone,
    sendSmsCode, kuroLogin, showGeetestCaptcha,
    getKuroRoleList, getAreaData, getPrisonerCageData, getRoleIndexData, refreshKuroData, getAccountData
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
import { useCountUp } from '../utils/countUp.js';

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

// 手机号脱敏显示（138****0000）
function maskPhone(p) {
    if (!p) return '';
    return String(p).replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2');
}

// 三步使用引导（横向步骤条）
// 1 登录网站账号 2 登录库街区 3 同步分数
function SetupGuide({ loggedIn, kuroBound, weekSaved, authReady, onOpenLogin, onSyncRequest }) {
    return (
        <div className="setup-guide">
            <div className="setup-guide-header">
                <div className="setup-guide-title">使用引导</div>
                <div className="setup-guide-sub">三步开启「分数一键同步 · 历史多端可查」</div>
            </div>
            <div className="guide-steps">
                <div className={`guide-step${loggedIn ? ' done' : ''}`} onClick={() => !loggedIn && onOpenLogin && onOpenLogin('web')}>
                    <div className="guide-step-dot">{loggedIn ? '✓' : '1'}</div>
                    <div className="guide-step-info">
                        <div className="guide-step-title">登录网站账号</div>
                        <div className="guide-step-lights">
                            <span className={`guide-light${loggedIn ? ' on' : ''}${!authReady ? ' checking' : ''}`}>
                                网站 {!authReady ? '检查中…' : (loggedIn ? '已登录' : '未登录')}
                            </span>
                        </div>
                    </div>
                    <button className="guide-action" onClick={e => { e.stopPropagation(); onOpenLogin && onOpenLogin('web'); }}>
                        {loggedIn ? '登录状态' : '登录/注册'}
                    </button>
                </div>
                <div className={`guide-step${kuroBound ? ' done' : ''}`} onClick={() => !kuroBound && onOpenLogin && onOpenLogin('kuro')}>
                    <div className="guide-step-dot">{kuroBound ? '✓' : '2'}</div>
                    <div className="guide-step-info">
                        <div className="guide-step-title">登录库街区</div>
                        <div className="guide-step-lights">
                            <span className={`guide-light${kuroBound ? ' on' : ''}`}>库街区 {kuroBound ? '已绑定' : '未绑定'}</span>
                        </div>
                    </div>
                    <button className="guide-action guide-action-kuro" onClick={e => { e.stopPropagation(); onOpenLogin && onOpenLogin('kuro'); }}>
                        {kuroBound ? '绑定状态' : '去绑定'}
                    </button>
                </div>
                <div className={`guide-step${weekSaved ? ' done' : ''}`} onClick={() => !weekSaved && onSyncRequest && onSyncRequest()}>
                    <div className="guide-step-dot">{weekSaved ? '✓' : '3'}</div>
                    <div className="guide-step-info">
                        <div className="guide-step-title">同步分数</div>
                        <div className="guide-step-desc">{weekSaved ? '已完成 · 已备份云端' : '一键拉取游戏内最新分数'}</div>
                    </div>
                    <button className="guide-action" onClick={e => { e.stopPropagation(); onSyncRequest && onSyncRequest(); }}>
                        同步分数
                    </button>
                </div>
            </div>
        </div>
    );
}

// 登录弹窗：网站账号（登录/注册） + 库街区（验证码绑定）双 tab
// 已登录/已绑定时显示状态视图，不再重复表单
function LoginModal({ tab, onClose, onLoggedIn, userLoggedIn, kuroBound }) {
    const [mode, setMode] = useState(tab === 'kuro' ? 'kuro' : 'web');
    // 网站账号
    const [id, setId] = useState('');
    const [pw, setPw] = useState('');
    const [isReg, setIsReg] = useState(false);
    // 库街区
    const [phone, setPhone] = useState('');
    const [code, setCode] = useState('');
    const [countdown, setCountdown] = useState(0);
    const [msg, setMsg] = useState('');
    const [busy, setBusy] = useState('');

    const doWeb = async () => {
        setMsg('');
        setBusy(isReg ? '注册中…' : '登录中…');
        try {
            if (isReg) await auth.register(id.trim(), pw);
            else await auth.login(id.trim(), pw);
            setBusy('');
            onLoggedIn && onLoggedIn();
        } catch (e) {
            setBusy('');
            setMsg(e.message || (isReg ? '注册失败' : '登录失败'));
        }
    };

    const sendKuroCode = async () => {
        if (!/^1[3-9]\d{9}$/.test(phone)) return setMsg('请输入正确的11位手机号');
        setMsg('请完成滑块验证…');
        try {
            const gt = await showGeetestCaptcha();
            setMsg('正在发送验证码…');
            await sendSmsCode(phone, gt);
            setMsg('验证码已发送，请查收短信');
            let n = 60;
            setCountdown(n);
            const timer = setInterval(() => {
                n -= 1;
                if (n <= 0) { clearInterval(timer); setCountdown(0); } else setCountdown(n);
            }, 1000);
        } catch (e) {
            setMsg(e.message || '发送失败');
        }
    };

    const doKuro = async () => {
        if (!/^1[3-9]\d{9}$/.test(phone)) return setMsg('请输入正确的11位手机号');
        if (!code) return setMsg('请输入验证码');
        setMsg('');
        setBusy('登录中…');
        try {
            const result = await kuroLogin(phone, code);
            if (result && result.token) setKuroToken(result.token);
            setKuroPhone(phone);
            const curUser = auth.isLoggedIn() ? auth.playerId : null;
            if (curUser) localStorage.setItem('kurobbs_bound_user', curUser);
            setBusy('');
            onLoggedIn && onLoggedIn();
        } catch (e) {
            setBusy('');
            setMsg(e.message || '绑定失败');
        }
    };

    return (
        <Modal title={mode === 'web' ? '网站账号登录' : '库街区绑定'} onClose={onClose}>
            <div className="login-modal-tabs">
                <button className={`login-modal-tab${mode === 'web' ? ' active' : ''}`} onClick={() => { setMode('web'); setMsg(''); }}>网站账号</button>
                <button className={`login-modal-tab${mode === 'kuro' ? ' active' : ''}`} onClick={() => { setMode('kuro'); setMsg(''); }}>库街区绑定</button>
            </div>

            {mode === 'web' ? (
                userLoggedIn ? (
                    <div className="login-modal-body">
                        <div className="login-done">
                            <div className="login-done-icon">✓</div>
                            <div className="login-done-text">
                                <b>网站账号已登录</b>
                                <span>账号：{auth.playerName || auth.playerId}</span>
                                <span>云端同步已开启 · 分数/历史多端可查</span>
                            </div>
                        </div>
                        <button className="bind-btn" style={{ width: '100%', minHeight: 44 }} onClick={onClose}>完成</button>
                    </div>
                ) : (
                    <div className="login-modal-body">
                        <input
                            className="bind-input"
                            style={{ width: '100%', maxWidth: 'none' }}
                            placeholder="账号（手机号/用户名）"
                            value={id}
                            onChange={e => setId(e.target.value)}
                        />
                        <input
                            className="bind-input"
                            style={{ width: '100%', maxWidth: 'none' }}
                            type="password"
                            placeholder="密码"
                            value={pw}
                            onChange={e => setPw(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') doWeb(); }}
                        />
                        <button className="bind-btn" style={{ width: '100%', minHeight: 44 }} disabled={!!busy} onClick={doWeb}>
                            {busy || (isReg ? '注册并登录' : '登录')}
                        </button>
                        <button className="login-modal-switch" onClick={() => { setIsReg(r => !r); setMsg(''); }}>
                            {isReg ? '已有账号？去登录' : '没有账号？一键注册'}
                        </button>
                        {msg && <div className="data-mgmt-msg">{msg}</div>}
                    </div>
                )
            ) : (
                kuroBound ? (
                    <div className="login-modal-body">
                        <div className="login-done">
                            <div className="login-done-icon">✓</div>
                            <div className="login-done-text">
                                <b>库街区已绑定</b>
                                <span>手机号：{maskPhone(getKuroPhone())}</span>
                                <span>每周点「同步分数」一键拉取游戏内战区 / 幻痛数据</span>
                            </div>
                        </div>
                        <button className="bind-btn" style={{ width: '100%', minHeight: 44 }} onClick={onClose}>完成</button>
                    </div>
                ) : (
                    <div className="login-modal-body">
                        <div className="kuro-bound-hint">绑定后每周点「同步分数」，一键拉取游戏内战区 / 幻痛数据（需先在库街区App打开「纷争战区」刷新）</div>
                        <input
                            className="bind-input"
                            style={{ width: '100%', maxWidth: 'none' }}
                            placeholder="库街区绑定手机号"
                            value={phone}
                            onChange={e => setPhone(e.target.value)}
                        />
                        <div className="login-modal-code-row">
                            <input
                                className="bind-input"
                                placeholder="验证码"
                                value={code}
                                onChange={e => setCode(e.target.value)}
                            />
                            <button className="bind-btn login-modal-send" disabled={countdown > 0 || !!busy} onClick={sendKuroCode}>
                                {countdown > 0 ? `${countdown}s` : '发送验证码'}
                            </button>
                        </div>
                        <button className="bind-btn" style={{ width: '100%', minHeight: 44 }} disabled={!!busy} onClick={doKuro}>
                            {busy || '绑定并登录'}
                        </button>
                        {msg && <div className="data-mgmt-msg">{msg}</div>}
                    </div>
                )
            )}
        </Modal>
    );
}

// 周区间日期标签：由保存时刻推算所在周的周一~周日（同年 Y.M.D~M.D，跨年两端带年）
function weekRangeLabel(ts) {
    if (!ts) return '';
    try {
        const d = new Date(ts);
        const offset = (d.getDay() + 6) % 7;
        const mon = new Date(d);
        mon.setDate(d.getDate() - offset);
        const sun = new Date(mon);
        sun.setDate(mon.getDate() + 6);
        const start = `${mon.getFullYear()}.${mon.getMonth() + 1}.${mon.getDate()}`;
        const end = sun.getFullYear() === mon.getFullYear()
            ? `${sun.getMonth() + 1}.${sun.getDate()}`
            : `${sun.getFullYear()}.${sun.getMonth() + 1}.${sun.getDate()}`;
        return `${start}~${end}`;
    } catch { return ''; }
}

// 从完整区数据提取区元信息：机制标签（怪数量按机制名映射：困兽犹斗=单怪/祸不单行=双怪/其他=群怪）
// + 子区名（如熵钟异数区可选打猩红冰原/岩流深壑，分数取高者；buffs 中与区名不同者为子区名）
function extractZoneTags(full) {
    const desc = (full && full.description) || '';
    const mech = desc.split('：')[0].split(':')[0];
    const monster = mech === '困兽犹斗' ? '单怪' : mech === '祸不单行' ? '双怪' : mech ? '群怪' : '';
    const subZones = ((full && full.buffs) || [])
        .map(b => b.name)
        .filter(n => n && n !== (full && full.name));
    return { mech, monster, subZones };
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
                            <td className="score-week-cell">第{s.week}周<span className="score-week-range">{weekRangeLabel(s.timestamp)}</span></td>
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
            <CurveChart title="今日按时趋势" data={todayData} zones={zoneList} mode="today" hasData={hasToday} showTotal startDelay={0} />
            <CurveChart title="本周按天趋势（周一~周日）" data={dayData} zones={zoneList} mode="week" hasData={hasWeek} showTotal startDelay={260} />
        </div>
    );
}

// 战区历史记录（本周分数由「本周分数」卡片展示）
function WzScoreSection({ zones, syncStamp, onChanged }) {
    const [scores, setScores] = useState(getScores(WZ_SCORE_KEY));
    const [pendingWeek, setPendingWeek] = useState(null);
    const [teamRecord, setTeamRecord] = useState(null);

    useEffect(() => { setScores(getScores(WZ_SCORE_KEY)); }, [syncStamp]);

    // 旧记录机制标签补齐：历史数据保存时无 mech/weather 字段，按记录周请求 API 补标签并写回
    useEffect(() => {
        // 旧记录补齐：monster 或 subZones 字段缺失都触发（subZones 为空数组属正常，仅字段缺失需补）
        const needsBackfill = scores.filter(s => (s.zones || []).some(z => z.subZones === undefined || !z.monster));
        if (needsBackfill.length === 0) return;
        let cancelled = false;
        (async () => {
            const patches = [];
            for (const s of needsBackfill) {
                try {
                    const diff = matchDifficulty(s.groupName, s.groupLevel);
                    const wz = await loadWarzone(diff, s.week);
                    const fullZones = (wz.warzone && wz.warzone.area && wz.warzone.area.zones) || [];
                    const patched = {
                        ...s,
                        zones: (s.zones || []).map(z => {
                            const full = fullZones.find(f => f.name === z.name);
                            if (!full) return z;
                            return { ...z, ...extractZoneTags(full) };
                        })
                    };
                    patches.push(patched);
                } catch { /* 历史周数据不可得则保持原样 */ }
                if (cancelled) return;
            }
            if (cancelled || patches.length === 0) return;
            const all = getScores(WZ_SCORE_KEY).map(s => {
                const p = patches.find(x => String(x.week) === String(s.week));
                return p || s;
            });
            localStorage.setItem(WZ_SCORE_KEY, JSON.stringify(all));
            if (auth.isLoggedIn()) auth.syncToCloud('wz_scores', all);
            setScores(all);
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scores]);

    const del = week => {
        const next = getScores(WZ_SCORE_KEY).filter(s => s.week !== week);
        localStorage.setItem(WZ_SCORE_KEY, JSON.stringify(next));
        if (auth.isLoggedIn()) auth.syncToCloud('wz_scores', next);
        setScores(next);
        onChanged && onChanged();
    };

    if (zones.length === 0) return <div className="score-input-label">加载战区数据中…</div>;

    const latest = scores[0];
    // 表头用通用列名（每周区名/机制不同，区名在行内单元格自描述，避免错位）
    const columns = latest ? latest.zones.map((z, i) => `区${i + 1}`) : zones.map((z, i) => `区${i + 1}`);
    const pending = scores.find(s => s.week === pendingWeek);

    return (
        <div className="mine-section">
            <div className="mine-section-header">
                <h3><span className="step-badge">2</span>我的战区</h3>
            </div>
            <MyTrendSection zones={zones} syncStamp={syncStamp} />
            <div className="score-note">
                注意：历史记录自「登录网站账号 + 绑定库街区」后开始记录每周分数；<b>每周日战区结算前</b>请进入网站同步分数（进页面自动同步，也可点「同步分数」手动同步），分数会随账号上传云端，换设备登录可查
            </div>
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
                                <span className="score-cell-head">
                                    <span className="score-cell-zone">
                                        {z.name}
                                        {z.subZones && z.subZones.length > 0 && (
                                            <span className="score-cell-sub">（{z.subZones.join('/')}）</span>
                                        )}
                                    </span>
                                    {z.monster && <em className="score-cell-mech" title={z.mech || ''}>{z.monster}</em>}
                                </span>
                                <span className="score-cell-val">{formatNumber(z.score)}</span>
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
function KuroBlock({ onSyncData, onBoundChange, authReady, authTick, syncRef }) {
    const [phone, setPhone] = useState('');
    const [boundPhone, setBoundPhone] = useState(getKuroPhone());
    const [code, setCode] = useState('');
    const [countdown, setCountdown] = useState(0);
    const [token, setToken] = useState(getKuroToken());
    const [accountInfo, setAccountInfo] = useState(null); // { roleName, serverName, level, rank }
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
            // 先调库街区刷新接口（等同App打开页面）：服务器从游戏拉最新数据，避免拿到缓存旧成绩
            try {
                await refreshKuroData(token, roleId, serverId);
            } catch { /* 刷新失败（频率限制等）则继续用缓存数据 */ }
            const [area, ppc] = await Promise.all([
                getAreaData(token, roleId, serverId),
                getPrisonerCageData(token, roleId, serverId)
            ]);
            const zones = {};
            ((area || {}).areaInfo || {}).stageFightInfoList.forEach(s => {
                if (!s.stageName) return;
                const team = [];
                // 子区关卡（buff）：每个 buff 关卡有独立区名/分数/战斗时间/增益（如熵钟异数=猩红冰原+岩流深壑）
                const subs = [];
                ((s.areaBuffFightInfoList) || []).forEach(bf => {
                    if (!bf.buffName) return;
                    subs.push({
                        name: bf.buffName,
                        score: bf.point || 0,
                        fightTime: bf.fightTime || 0,
                        supportBuffs: ((bf.supportBuffList) || []).map(sb => sb.name).filter(Boolean)
                    });
                    ((bf.bodyList) || []).forEach(bodyItem => {
                        const bodyInfo = (bodyItem.bodyInfo) || {};
                        const body = (bodyInfo.body) || {};
                        if (body.bodyName) team.push({ name: body.bodyName, grade: bodyInfo.grade || '', id: body.bodyId || '' });
                    });
                });
                s.subs = subs; // 写回原始数据（本周分数卡片直接渲染子区明细）
                zones[s.stageName] = {
                    score: s.point,
                    team,
                    subs,
                    subZones: subs.map(x => x.name)
                };
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
    // 对外暴露同步能力（引导块/卡片"同步分数"按钮调用）
    if (syncRef) syncRef.current = () => fetchScores(false);

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
            setAccountInfo(null);
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

    // 角色选中后拉取账号信息（勋阶/等级/头像）
    useEffect(() => {
        if (!token || !selRole) {
            setAccountInfo(null);
            return;
        }
        let cancelled = false;
        getAccountData(token, selRole.roleId, selRole.serverId || '1000').then(res => {
            if (cancelled || !res) return;
            setAccountInfo({
                roleName: res.roleName || selRole.roleName || '',
                serverName: res.serverName || selRole.serverName || '',
                level: res.level || 0,
                rank: res.rank || 0,
                headIconUrl: res.headIconUrl || ''
            });
        }).catch(() => { /* 账号信息获取失败不影响主流程 */ });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token, selRole]);

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
                        <div className="logged-in-id">
                            {(accountInfo && accountInfo.roleName) || (selRole ? selRole.roleName || '未知角色' : (busy || '获取角色中…'))}
                            {(accountInfo && accountInfo.serverName) || (selRole ? selRole.serverName || '' : '')}
                        </div>
                        {accountInfo && (
                            <div className="logged-in-rank">
                                {accountInfo.rank ? `勋阶 ${accountInfo.rank}` : `Lv.${accountInfo.level}`}
                                {accountInfo.rank && accountInfo.level ? ` · Lv.${accountInfo.level}` : ''}
                            </div>
                        )}
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
                        <div className="kuro-sync-tip">提示：分数不是最新？先在库街区App打开「纷争战区」页面刷新数据，再回来同步</div>
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
function WeekScoreCard({ area, ppc, roleId, serverId, trend, showTrendBtn, showSyncBtn, onSync, zones }) {
    const [activeStage, setActiveStage] = useState(null);
    const [compareStage, setCompareStage] = useState(null);
    const [showTrend, setShowTrend] = useState(false);
    if (!area && !ppc) return null;
    const areaInfo = (area || {}).areaInfo || {};
    const ppcInfo = ((ppc || {}).prisonerCage) || {};
    const areaEv = evaluateWzScore(areaInfo.totalPoint || 0);
    const myGroupName = (area || {}).groupName || '';
    const myGroupLevel = (area || {}).groupLevel || '';
    // 数字就位动画：总分/挑战次数从 0 滚动到最终值（仪表盘就位感）
    const areaTotal = useCountUp(areaInfo.totalPoint || 0);
    const areaTimes = useCountUp(areaInfo.totalChallengeTimes || 0);
    const ppcTotal = useCountUp(ppcInfo.totalPoint || 0);
    const ppcTimes = useCountUp(ppcInfo.totalChallengeTimes || 0);

    return (
        <div className="mine-section week-score-card">
            <div className="mine-section-header">
                <h3>本周分数</h3>
                <div className="week-card-actions">
                    {showSyncBtn && (
                        <button className="week-trend-btn week-sync-btn" onClick={() => onSync && onSync()}>同步分数</button>
                    )}
                    {showTrendBtn && trend && (
                        <button className="week-trend-btn" onClick={() => setShowTrend(true)}>趋势</button>
                    )}
                </div>
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
                                <span className="week-stat-num">{formatNumber(areaTotal)}</span>
                                <span className="week-stat-label">总分</span>
                            </div>
                            <div className="week-stat">
                                <span className="week-stat-num">{areaTimes}</span>
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
                                    {s.subs && s.subs.length > 0 && (
                                        <div className="week-zone-subs">
                                            {s.subs.map((sub, k) => (
                                                <span className="week-zone-sub-item" key={k}>
                                                    {sub.name} {formatNumber(sub.score)}分
                                                    {sub.fightTime ? <em>· {sub.fightTime}min</em> : null}
                                                </span>
                                            ))}
                                        </div>
                                    )}
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
                                <span className="week-stat-num">{formatNumber(ppcTotal)}</span>
                                <span className="week-stat-label">总分</span>
                            </div>
                            <div className="week-stat">
                                <span className="week-stat-num">{ppcTimes}</span>
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
function AccountSection({ onSyncData, onAuthChange, onBoundChange, authReady, authTick, syncRef }) {
    return (
        <div className="mine-section" id="mine-account">
            <div className="mine-section-header"><h3><span className="step-badge">1</span>账号 · 库街区</h3></div>
            <div className="account-grid">
                <WebLoginBlock onAuthChange={onAuthChange} />
                <KuroBlock onSyncData={onSyncData} onBoundChange={onBoundChange} authReady={authReady} authTick={authTick} syncRef={syncRef} />
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
                    const tagged = { ...z, ...extractZoneTags(full) };
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
    const [loginModal, setLoginModal] = useState(null); // null | 'web' | 'kuro'
    const syncScoreRef = useRef(null); // 库街区同步函数（KuroBlock 注册）

    const removeFollow = id => {
        const next = follows.filter(f => String(f.id) !== String(id));
        saveFollows(next);
        setFollows(next);
    };

    return (
        <div>
            <SetupGuide
                loggedIn={!!user}
                kuroBound={kuroBound}
                weekSaved={weekSaved}
                authReady={authReady}
                onOpenLogin={setLoginModal}
                onSyncRequest={() => syncScoreRef.current && syncScoreRef.current()}
            />

            <WeekScoreCard
                area={syncData ? syncData.area : null}
                ppc={syncData ? syncData.ppc : null}
                roleId={syncData ? syncData.roleId : null}
                serverId={syncData ? syncData.serverId : null}
                zones={wzZones}
                trend={trend}
                showTrendBtn={isMobile}
                showSyncBtn={isMobile && kuroBound}
                onSync={() => syncScoreRef.current && syncScoreRef.current()}
            />

            <div id="mine-scores">
                <WzScoreSection zones={wzZones} syncStamp={syncStamp} onChanged={() => setWeekSaved(getScores(WZ_SCORE_KEY).some(s => String(s.week) === String(wzWeek)))} />
                <PpcScoreSection bosses={ppcBosses} currentWeek={ppcWeek} syncStamp={syncStamp} onChanged={() => setWeekSaved(getScores(WZ_SCORE_KEY).some(s => String(s.week) === String(wzWeek)))} />
            </div>

            <AccountSection
                onSyncData={saveSyncedScores}
                onAuthChange={u => { setUser(u); setAuthTick(t => t + 1); }}
                onBoundChange={setKuroBound}
                authReady={authReady}
                authTick={authTick}
                syncRef={syncScoreRef}
            />

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

            {loginModal && (
                <LoginModal
                    tab={loginModal}
                    onClose={() => setLoginModal(null)}
                    userLoggedIn={!!user}
                    kuroBound={kuroBound}
                    onLoggedIn={() => {
                        setLoginModal(null);
                        setUser(auth.isLoggedIn() ? { id: auth.playerId, name: auth.playerName } : null);
                        setAuthTick(t => t + 1); // 触发库街区恢复绑定/自动同步
                        setKuroBound(!!getKuroToken());
                    }}
                />
            )}
        </div>
    );
}
