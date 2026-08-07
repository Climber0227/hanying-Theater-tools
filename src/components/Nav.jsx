import React, { useEffect, useState } from 'react';

const PAGES = [
    { key: 'warzone', label: '战区数据' },
    { key: 'player', label: '玩家查询' },
    { key: 'ppc', label: '幻痛囚笼' },
    { key: 'mine', label: '我的' }
];

// 建站起始时间
const SITE_START = new Date('2026-05-04T00:00:00');

// 访问计数：线上走 /api/visit 原子自增，本地开发用 localStorage 兜底
const IS_WEB = true;
const IS_LOCAL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const VISIT_KEY = 'huaxu_visit_count';

export default function Nav({ current, onChange }) {
    const [duration, setDuration] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
    const [visits, setVisits] = useState(0);

    // 建站时长（每秒更新）
    useEffect(() => {
        const tick = () => {
            const diff = Math.floor((Date.now() - SITE_START.getTime()) / 1000);
            setDuration({
                days: Math.floor(diff / 86400),
                hours: Math.floor((diff % 86400) / 3600),
                minutes: Math.floor((diff % 3600) / 60),
                seconds: diff % 60
            });
        };
        tick();
        const timer = setInterval(tick, 1000);
        return () => clearInterval(timer);
    }, []);

    // 访问计数
    useEffect(() => {
        if (IS_WEB && !IS_LOCAL) {
            fetch('/api/visit')
                .then(r => r.json())
                .then(d => { if (d.status === 'success') setVisits(d.count); })
                .catch(() => setVisits('--'));
        } else {
            try {
                const c = parseInt(localStorage.getItem(VISIT_KEY)) || 0;
                const next = c + 1;
                localStorage.setItem(VISIT_KEY, String(next));
                setVisits(next);
            } catch { setVisits('--'); }
        }
    }, []);

    return (
        <nav className="nav">
            <div className="nav-stats">
                <span>建站 <strong>{duration.days}</strong> 天 <strong>{duration.hours}</strong> 时 <strong>{duration.minutes}</strong> 分 <strong>{duration.seconds}</strong> 秒</span>
                <span className="stats-divider">|</span>
                <span>访问 <strong>{visits}</strong> 次</span>
                <span className="stats-divider">|</span>
                <span>数据来源 <a href="https://huaxu.app" target="_blank" rel="noreferrer">huaxu.app</a></span>
            </div>
            <div className="nav-btns">
                {PAGES.map(p => (
                    <button
                        key={p.key}
                        className={`nav-btn${current === p.key ? ' active' : ''}`}
                        onClick={() => onChange(p.key)}
                    >
                        {p.label}
                    </button>
                ))}
            </div>
        </nav>
    );
}
