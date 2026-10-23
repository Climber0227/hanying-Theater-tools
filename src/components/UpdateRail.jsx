import React, { useCallback, useEffect, useRef, useState } from 'react';
import useMediaQuery, { MOBILE_QUERY } from '../hooks/useMediaQuery.js';
import { CHANGELOG } from '../data/changelog.js';

// 首页的「最近更新」公告
// - 桌面：直接挂一张卡片在页面左侧（不挡导航、可一键收进竖标）
// - 手机：右下角一个悬浮按钮，点开是底部弹层
// 点任意一条 / 底部按钮都跳到「更新日志」页。
// 只取前 3 条：完整日志在 ChangelogPage（framer-motion + 全量数据，单独 chunk），
// 这里只 import 数据，不会把那个 chunk 拖进首屏。

const SEEN_KEY = 'huaxu_changelog_seen';
const TUCK_KEY = 'huaxu_update_tucked';
const LATEST = 3;

// 2026-10-23 → 10.23
function shortDate(d) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d || ''));
    return m ? `${m[2]}.${m[3]}` : String(d || '');
}

function EntryList({ entries, onPick }) {
    return (
        <ol className="uc-list">
            {entries.map((entry, i) => (
                <li className="uc-item" key={entry.date}>
                    <button type="button" className="uc-link" onClick={onPick} title="查看完整更新日志">
                        <span className={`uc-dot${i === 0 ? ' uc-dot-new' : ''}`} aria-hidden="true" />
                        <span className="uc-date">{shortDate(entry.date)}</span>
                        <span className="uc-text">{entry.items[0]}</span>
                        {entry.items.length > 1 && <span className="uc-more">+{entry.items.length - 1}</span>}
                    </button>
                </li>
            ))}
        </ol>
    );
}

function CardHead({ unread, onClose, closeLabel }) {
    return (
        <div className="uc-head">
            <span className="uc-title">
                最近更新
                {unread && <span className="uc-new">NEW</span>}
            </span>
            <button type="button" className="uc-close" onClick={onClose} aria-label={closeLabel} title={closeLabel}>
                ×
            </button>
        </div>
    );
}

export default function UpdateRail({ onChangePage }) {
    const isMobile = useMediaQuery(MOBILE_QUERY);
    const [open, setOpen] = useState(false);
    const [tucked, setTucked] = useState(() => {
        try { return localStorage.getItem(TUCK_KEY) === '1'; } catch { return false; }
    });
    const [seen, setSeen] = useState(() => {
        try { return localStorage.getItem(SEEN_KEY) || ''; } catch { return ''; }
    });

    const entries = CHANGELOG.slice(0, LATEST);
    const newest = CHANGELOG[0] ? CHANGELOG[0].date : '';
    const unread = !!newest && (!seen || seen < newest);

    const markSeen = useCallback(() => {
        if (!newest) return;
        try { localStorage.setItem(SEEN_KEY, newest); } catch { /* 隐私模式忽略 */ }
        setSeen(newest);
    }, [newest]);

    const goChangelog = useCallback(() => {
        markSeen();
        setOpen(false);
        if (onChangePage) onChangePage('changelog');
    }, [markSeen, onChangePage]);

    const tuck = useCallback(() => {
        setTucked(true);
        try { localStorage.setItem(TUCK_KEY, '1'); } catch { /* 忽略 */ }
    }, []);

    const untuck = useCallback(() => {
        setTucked(false);
        try { localStorage.removeItem(TUCK_KEY); } catch { /* 忽略 */ }
        markSeen();
    }, [markSeen]);

    // 展开 / 点开即视为已读
    useEffect(() => {
        if (open && !tucked) markSeen();
    }, [open, tucked, markSeen]);

    // 手机弹层：Esc 关闭 + 锁背景滚动
    useEffect(() => {
        if (!isMobile || !open) return;
        const onKey = e => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('keydown', onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = prev;
        };
    }, [isMobile, open]);

    if (isMobile) {
        return (
            <>
                <button
                    type="button"
                    className={`update-fab${open ? ' open' : ''}`}
                    onClick={() => setOpen(o => !o)}
                    aria-label="更新公告"
                    aria-expanded={open}
                    title="更新公告"
                >
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M3 12a9 9 0 1 0 9-9" />
                        <path d="M3 4v5h5" />
                        <path d="M12 8v4l2.5 1.5" />
                    </svg>
                    {unread && <span className="update-fab-dot" aria-hidden="true" />}
                </button>

                {open && (
                    <>
                        <div className="update-sheet-backdrop" onClick={() => setOpen(false)} />
                        <div className="update-sheet" role="dialog" aria-label="最近更新">
                            <div className="update-sheet-grab" aria-hidden="true" />
                            <CardHead unread={false} onClose={() => setOpen(false)} closeLabel="关闭" />
                            <EntryList entries={entries} onPick={goChangelog} />
                            <button type="button" className="uc-all" onClick={goChangelog}>
                                查看完整更新日志
                                <span aria-hidden="true">→</span>
                            </button>
                        </div>
                    </>
                )}
            </>
        );
    }

    if (tucked) {
        return (
            <button type="button" className="update-tab" onClick={untuck} aria-label="展开更新公告" title="展开更新公告">
                {unread && <span className="update-tab-dot" aria-hidden="true" />}
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 12a9 9 0 1 0 9-9" />
                    <path d="M3 4v5h5" />
                    <path d="M12 8v4l2.5 1.5" />
                </svg>
                <span className="update-tab-text">更新</span>
            </button>
        );
    }

    return (
        <aside className="update-card" aria-label="最近更新">
            <CardHead unread={unread} onClose={tuck} closeLabel="收起更新公告" />
            <EntryList entries={entries} onPick={goChangelog} />
            <button type="button" className="uc-all" onClick={goChangelog}>
                查看完整更新日志
                <span aria-hidden="true">→</span>
            </button>
        </aside>
    );
}
