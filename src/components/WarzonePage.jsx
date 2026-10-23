import React, { useMemo } from 'react';
import { useWarzone } from '../hooks/useWarzone.js';
import { DIFFICULTY_OPTIONS, getDifficultyShort } from '../api/config.js';
import { formatNumber } from '../utils/format.js';
import ZoneCards from './ZoneCards.jsx';
import RankingPanel from './Ranking/RankingPanel.jsx';

// 难度分段：源站 16 档按大段归并，先选段位再选分段
const TIERS = [
    { name: '传奇', values: ['16'] },
    { name: '英雄', values: ['15'] },
    { name: '领袖', values: ['14', '13'] },
    { name: '尖兵', values: ['12', '11', '10'] },
    { name: '先锋', values: ['9', '8', '7'] },
    { name: '侦察', values: ['6', '5', '4'] },
    { name: '预备', values: ['3', '2', '1'] }
];

function bracketLabel(value) {
    const opt = DIFFICULTY_OPTIONS.find(o => o.value === String(value));
    if (!opt) return String(value);
    const m = opt.label.match(/[（(]([^）)]+)[）)]/);
    return m ? m[1] : opt.label;
}

function DifficultySwitch({ difficulty, onChange }) {
    const tier = TIERS.find(t => t.values.includes(String(difficulty))) || TIERS[0];
    return (
        <div className="difficulty-switch">
            <div className="seg">
                {TIERS.map(t => (
                    <button
                        key={t.name}
                        className={`seg-btn${t.name === tier.name ? ' active' : ''}`}
                        onClick={() => { if (t.name !== tier.name) onChange(t.values[0]); }}
                        title={getDifficultyShort(t.values[0])}
                    >
                        {t.name}
                    </button>
                ))}
            </div>
            {tier.values.length > 1 && (
                <select
                    className="seg-bracket"
                    value={String(difficulty)}
                    onChange={e => onChange(e.target.value)}
                    aria-label="分段"
                >
                    {tier.values.map(v => (
                        <option key={v} value={v}>{bracketLabel(v)}</option>
                    ))}
                </select>
            )}
        </div>
    );
}

// 2026-10-18T21:00:00Z → 10.18
function shortDate(iso) {
    if (!iso) return '';
    const m = String(iso).match(/^\d{4}-(\d{2})-(\d{2})/);
    return m ? `${m[1]}.${m[2]}` : '';
}

// 2026-10-23T10:31:00.001381Z → 10-23 18:31（本地时区）
function shortUpdated(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const p = n => String(n).padStart(2, '0');
    return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function WarzonePage({ onOpenPlayer }) {
    const warzone = useWarzone();
    const { difficulty, setDifficulty, week, currentWeek, zones, rankings, meta } = warzone;

    const weekNo = week == null ? currentWeek : week;
    const dateLabel = useMemo(() => {
        const raw = String(meta.dateRange || '');
        const parts = raw.split('~').map(s => shortDate(s.trim()));
        return parts.length === 2 && parts[0] && parts[1] ? `${parts[0]} — ${parts[1]}` : '';
    }, [meta.dateRange]);
    const updatedLabel = shortUpdated(meta.updatedAt);

    // 榜首 / 单区最高：给顶部数据条用
    const topEntry = (rankings || [])[0];
    const topScore = topEntry && topEntry.score > 0 ? topEntry.score : 0;
    const topName = topEntry && topEntry.player ? topEntry.player.name : '';
    const zoneBest = useMemo(() => {
        let best = null;
        (rankings || []).forEach(r => {
            if (!r || !r.player) return;
            (r.zones || []).forEach(zd => {
                if (!zd || zd.id == null || !(zd.score > 0)) return;
                if (!best || zd.score > best.score) best = { score: zd.score, name: r.player.name || '' };
            });
        });
        return best;
    }, [rankings]);

    return (
        <>
            <header className="page-head">
                <div className="page-head-main">
                    <h1 className="page-title">战区数据</h1>
                    <div className="page-meta">
                        {weekNo != null && <span>第 <b>{weekNo}</b> 周</span>}
                        {dateLabel && <><span className="meta-dot" /><span>{dateLabel}</span></>}
                        {updatedLabel && (
                            <span className="meta-updated">
                                <span className="meta-dot" />
                                <span>更新于 {updatedLabel}</span>
                            </span>
                        )}
                    </div>
                </div>
                <DifficultySwitch difficulty={difficulty} onChange={setDifficulty} />
            </header>

            <section className="stat-strip">
                <div className="stat-item">
                    <span className="stat-label">本周参与</span>
                    <span className="stat-value">
                        {meta.members ? formatNumber(meta.members) : '—'}
                        <em>人</em>
                    </span>
                </div>
                <div className="stat-item">
                    <span className="stat-label">榜首总分</span>
                    <span className="stat-value">{topScore ? formatNumber(topScore) : '—'}</span>
                    <span className="stat-sub">{topName || '暂无数据'}</span>
                </div>
                <div className="stat-item stat-item-hide-sm">
                    <span className="stat-label">单区最高</span>
                    <span className="stat-value">{zoneBest ? formatNumber(zoneBest.score) : '—'}</span>
                    <span className="stat-sub">{zoneBest ? zoneBest.name : '暂无数据'}</span>
                </div>
                <div className="stat-item stat-item-hide-sm">
                    <span className="stat-label">榜单刷新</span>
                    <span className="stat-value stat-value-sm">{updatedLabel || '—'}</span>
                    <span className="stat-sub">数据来源 huaxu.app</span>
                </div>
            </section>

            <ZoneCards zones={zones} rankings={rankings} loading={warzone.loading} />
            <RankingPanel warzone={warzone} onOpenPlayer={onOpenPlayer} />
        </>
    );
}
