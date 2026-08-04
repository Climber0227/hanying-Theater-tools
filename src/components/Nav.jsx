import React from 'react';

const PAGES = [
    { key: 'warzone', label: '战区数据' },
    { key: 'player', label: '玩家查询' },
    { key: 'ppc', label: '幻痛囚笼' },
    { key: 'mine', label: '我的' }
];

export default function Nav({ current, onChange }) {
    return (
        <nav className="nav">
            <div className="nav-stats">
                <span>建站 <strong id="siteDays">0</strong> 天</span>
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
