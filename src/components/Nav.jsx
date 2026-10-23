import React, { useEffect, useState } from 'react';

const PAGES = [
    { key: 'warzone', label: '战区数据' },
    { key: 'player', label: '玩家查询' },
    { key: 'ppc', label: '幻痛囚笼' },
    { key: 'mine', label: '我的' },
    { key: 'changelog', label: '更新日志' }
];

// 建站起始时间
const SITE_START = new Date('2026-05-04T00:00:00');

// 访问计数：线上走 /api/visit 原子自增，本地开发用 localStorage 兜底
const IS_WEB = true;
const IS_LOCAL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const VISIT_KEY = 'huaxu_visit_count';

// 建站天数独立成组件：每分钟刷新也只重渲染这几个字，不带动整条导航
function Uptime() {
    const [days, setDays] = useState(() => Math.max(0, Math.floor((Date.now() - SITE_START.getTime()) / 86400000)));
    useEffect(() => {
        const timer = setInterval(() => {
            setDays(Math.max(0, Math.floor((Date.now() - SITE_START.getTime()) / 86400000)));
        }, 60000);
        return () => clearInterval(timer);
    }, []);
    return (
        <span className="nav-meta-item nav-meta-uptime">
            已运行 <b>{days}</b> 天
        </span>
    );
}

export default function Nav({ current, onChange }) {
    const [visits, setVisits] = useState(0);

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
            <button className="nav-brand" onClick={() => onChange('warzone')} title="返回首页">
                <span className="nav-logo">含</span>
                <span className="nav-brand-text">
                    <span className="nav-brand-name">含英牌战区数据</span>
                    <span className="nav-brand-sub">战双帕弥什 · 榜单分析</span>
                </span>
            </button>

            <div className="nav-tabs">
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

            <div className="nav-meta">
                <span className="nav-meta-item">
                    <i className="nav-meta-dot" />
                    数据来源 <a href="https://huaxu.app" target="_blank" rel="noreferrer">huaxu.app</a>
                </span>
                <span className="nav-meta-sep" />
                <span className="nav-meta-item">
                    访问 <b>{visits}</b> 次
                </span>
                <span className="nav-meta-sep nav-meta-uptime" />
                <Uptime />
            </div>
        </nav>
    );
}
