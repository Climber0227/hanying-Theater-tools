# 手机端 UI 适配实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 让 React 版（Vite + React 19）在 ≤560px 视口（375px 目标设备）下获得完整可用体验——无横向溢出、触控友好、核心信息一级展示、详情进二级弹窗。

**架构：** 纯 CSS 媒体查询 + matchMedia 驱动 JS 常量（虚拟表格列宽/行高）双轨适配，不引新框架、不动数据层。主断点 `@media (max-width: 560px)`，排行榜行布局断点统一为 700px（JS/CSS 一致）。核心策略：排行榜紧凑卡片行 + 新建 PlayerRankModal 二级弹窗承接详细内容。

**技术栈：** React 19、Vite 8、react-window（虚拟列表）、framer-motion、recharts、Electron。验证用 Playwright（375px / 1440px 双视口回归）。

**设计依据：** `docs/移动端适配设计.md`（已定稿）。内容分级映射见该文档与本文任务描述。

**验证基线：** 每个页面 `document.documentElement.scrollWidth <= innerWidth`（表格容器内部横滚除外）；触控目标 ≥40px。

---

## 文件结构总览

**新建：**
- `src/hooks/useMediaQuery.js` — matchMedia 断点 hook（排行榜 JS/CSS 联动唯一数据源）
- `src/components/Modals/PlayerRankModal.jsx` — 手机端排行榜行点击的二级弹窗（玩家头 + 三区 tab）
- `scripts/mobile-check.mjs` — Playwright 双视口回归脚本

**修改：**
- `src/components/Ranking/VirtualRankingTable.jsx` — isMobile 列宽/行高联动
- `src/components/Ranking/RankingRow.jsx` — 手机紧凑行渲染 + 导出 TeamCompareTag 供复用
- `src/components/Ranking/RankingHeader.jsx` — 手机端折叠筛选面板
- `src/components/Ranking/RankingPanel.jsx` — playerRankTarget 状态 + PlayerRankModal 挂载
- `src/components/PpcPage.jsx` — 内联列宽改类名（手机可覆盖）
- `src/components/MinePage.jsx` — ScoreTable 包横滚容器
- `src/styles/app.css` — 导航两行、反馈按钮、hover 常显
- `src/styles/modals.css` — 弹窗全屏化
- `src/styles/pages.css` — 玩家/PPC/我的页断点
- `src/styles/ranking.css` — 排行榜断点（行/控制区/表头）
- `src/styles/zone.css` — 区卡手机断点
- `package.json` — 加 playwright devDependency + 脚本

---

### 任务 1：useMediaQuery hook

**文件：**
- 创建：`src/hooks/useMediaQuery.js`

- [ ] **步骤 1：创建 hook**

```jsx
import { useEffect, useState } from 'react';

// matchMedia 断点 hook：isMobile = 视口 <= 700px（与 CSS 断点一致）
export default function useMediaQuery(query) {
    const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
    useEffect(() => {
        const mql = window.matchMedia(query);
        const onChange = e => setMatches(e.matches);
        mql.addEventListener('change', onChange);
        return () => mql.removeEventListener('change', onChange);
    }, [query]);
    return matches;
}

export const MOBILE_QUERY = '(max-width: 700px)';
```

- [ ] **步骤 2：验证**

运行：`node -e "console.log(1)"`（语法冒烟，纯前端无单测框架；最终由任务 13 回归覆盖）
预期：输出 1

- [ ] **步骤 3：Commit**

```bash
git add src/hooks/useMediaQuery.js
git commit -m "feat: 新增 useMediaQuery hook（排行榜 JS/CSS 联动断点）"
```

---

### 任务 2：全局 + 导航手机布局

**文件：**
- 修改：`src/styles/app.css`（在文件末尾追加断点段）
- 修改：`src/index.html`（viewport 已含 `user-scalable=yes`，无需改）

- [ ] **步骤 1：追加全局移动端基础样式**

在 `src/styles/app.css` 末尾追加：

```css
/* ========== 移动端 ≤560px ========== */
@media (max-width: 560px) {
    .container { padding: 10px; }
}

/* ========== 移动端 ≤700px（导航/排行榜布局断点） ========== */
@media (max-width: 700px) {
    .nav {
        flex-wrap: wrap;
        gap: 4px;
        padding: 8px 6px;
        border-radius: 12px;
        margin-bottom: 10px;
    }
    .nav-stats {
        width: 100%;
        justify-content: center;
        padding: 0 0 4px;
        font-size: 10px;
        gap: 4px;
    }
    .nav-stats .stats-divider { margin: 0 1px; }
    .nav-btns { padding: 0; }
    .nav-btn {
        padding: 8px 0;
        font-size: 13px;
        min-height: 40px;
    }
}
```

- [ ] **步骤 2：验证容器基准**

先在 `src/styles/app.css` 确认 `.container` 已有定义（未命中则在其后补 `@media (max-width: 560px) { .container { padding: 10px; } }`）。

运行：`npm run build`
预期：构建成功，无 CSS 报错

- [ ] **步骤 3：Commit**

```bash
git add src/styles/app.css
git commit -m "feat: 手机端全局基础——容器收窄、导航两行、tab 均分 40px 触控"
```

---

### 任务 3：弹窗壳全屏化

**文件：**
- 修改：`src/styles/modals.css`
- 修改：`src/styles/zone.css`（ZoneCards 自带的 `.modal`/`.modal-content` 副本，需同步覆盖，否则区卡详情弹窗不生效）

- [ ] **步骤 1：追加弹窗手机样式（modals.css 末尾）**

```css
/* ========== 移动端弹窗全屏化 ========== */
@media (max-width: 560px) {
    .modal-content {
        width: calc(100vw - 12px);
        max-width: 100vw;
        border-radius: 12px;
        max-height: 90vh;
        overflow-y: auto;
    }
    .modal-close {
        width: 36px;
        height: 36px;
        font-size: 20px;
    }
}
```

- [ ] **步骤 2：同步 zone.css 的弹窗副本**

在 `src/styles/zone.css` 末尾追加同段代码（复制上面代码块，内容一致）。注意：若 zone.css 的 `.modal-content` 已有 `max-width: 900px`，覆盖段优先级靠后即可生效；若无效需把选择器加权重为 `.modal .modal-content`。

- [ ] **步骤 3：验证**

运行：`npm run build`
预期：构建成功

- [ ] **步骤 4：Commit**

```bash
git add src/styles/modals.css src/styles/zone.css
git commit -m "feat: 手机端弹窗全屏化（calc(100vw-12px)/90vh 可滚/36px 关闭钮）"
```

---

### 任务 4：排行榜虚拟表格双模式（核心）

**文件：**
- 修改：`src/components/Ranking/VirtualRankingTable.jsx`
- 修改：`src/components/Ranking/RankingRow.jsx`
- 修改：`src/styles/ranking.css`（末尾追加 700px 断点段）

- [ ] **步骤 1：VirtualRankingTable 集成 useMediaQuery**

整文件替换为：

```jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { List } from 'react-window';
import RankingRow, { ROW_HEIGHT, ROW_HEIGHT_MOBILE } from './RankingRow.jsx';
import { computeTeamMaxScores } from '../../utils/ranking.js';
import useMediaQuery, { MOBILE_QUERY } from '../../hooks/useMediaQuery.js';

// 列宽常量（桌面与 CSS 一致）
const COL_RANK = 80;
const COL_PLAYER = 220;
const COL_ZONE = 268;
const COL_TOTAL = 160;
const COL_RESET = 56;

export default function VirtualRankingTable({ rows, zones, prevSnapshot, header, onOpenPlayer, onOpenAnalysis, onOpenTrend, onOpenMobileRow }) {
    const wrapRef = useRef(null);
    const [wrapHeight, setWrapHeight] = useState(640);
    const [headerH, setHeaderH] = useState(114);
    const isMobile = useMediaQuery(MOBILE_QUERY);

    const tableWidth = isMobile
        ? '100%'
        : COL_RANK + COL_PLAYER + (zones || []).length * COL_ZONE + COL_TOTAL + COL_RESET;

    useEffect(() => {
        const el = wrapRef.current;
        if (!el) return;
        const update = () => {
            setWrapHeight(el.clientHeight);
            const h = el.querySelector('.ranking-header');
            if (h) setHeaderH(h.offsetHeight);
        };
        update();
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, [zones, isMobile]);

    const teamMax = useMemo(() => computeTeamMaxScores(rows, zones), [rows, zones]);
    const totalMaxScore = useMemo(() => rows.reduce((m, r) => Math.max(m, r.score || 0), 0), [rows]);

    const listHeight = Math.max(wrapHeight - headerH, 120);

    return (
        <div className="ranking-table" ref={wrapRef}>
            <div style={{ width: tableWidth, minWidth: '100%' }}>
                {header}
                <List
                    rowCount={rows.length}
                    rowHeight={isMobile ? ROW_HEIGHT_MOBILE : ROW_HEIGHT}
                    rowComponent={RankingRow}
                    rowProps={{
                        rows,
                        zones,
                        teamMax,
                        totalMaxScore,
                        prevSnapshot,
                        isMobile,
                        onOpenPlayer,
                        onOpenAnalysis,
                        onOpenTrend,
                        onOpenMobileRow
                    }}
                    defaultHeight={listHeight}
                    style={{ height: listHeight }}
                    overscanCount={2}
                />
            </div>
        </div>
    );
}
```

- [ ] **步骤 2：RankingRow 手机紧凑行**

修改要点（保留桌面渲染不动，新增 isMobile 分支）：

1. 导出常量：`export const ROW_HEIGHT = 152; export const ROW_HEIGHT_MOBILE = 96;`
2. 新增行级移动端点击：整行 `onClick={() => isMobile && onOpenMobileRow && onOpenMobileRow(r)}`，行根元素加 `className={isMobile ? 'ranking-row ranking-row-mobile' : 'ranking-row...'}`
3. 新增 `MobileZoneBar` 组件（三区分数条）与 `MobileRow`（手机版行）：

```jsx
function MobileZoneBar({ zones, r, delta }) {
    return (
        <div className="mobile-zone-bar">
            {zones.map((zone, zi) => {
                const zd = r.zones ? r.zones.find(z => z.id === zone.id) : null;
                const zdDiff = delta && zd && Object.prototype.hasOwnProperty.call(delta.zoneScores, zone.id)
                    ? (zd.score || 0) - (delta.zoneScores[zone.id] || 0)
                    : null;
                return (
                    <div className="mobile-zone-seg" key={zone.id}>
                        <span className="mobile-zone-name">{zone.name}</span>
                        <span className="mobile-zone-score">
                            {zd ? formatNumber(zd.score) : '--'}
                            {zdDiff != null && (
                                zdDiff > 0
                                    ? <span className="score-delta-up">+{formatScoreCompact(zdDiff)}</span>
                                    : zdDiff < 0
                                        ? <span className="score-delta-down">-{formatScoreCompact(Math.abs(zdDiff))}</span>
                                        : <span className="score-delta-same">0</span>
                            )}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

function MobileRow({ r, zones, delta, topN, displayRank, portraitUrl, frameUrl, onOpenPlayer }) {
    return (
        <>
            <div className={`rank-num${topN ? ` top-${displayRank}` : ''}`}>
                {topN && <span className={`rank-medal medal-${displayRank}`}>{displayRank}</span>}
                {!topN && displayRank}
                <RankDelta delta={delta} />
            </div>
            <div className="player-info ranking-player mobile-player" onClick={e => { e.stopPropagation(); onOpenPlayer(r.player.id); }}>
                <div className="player-avatar-sm">
                    {portraitUrl && <img src={portraitUrl} alt="" decoding="async" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                    {frameUrl && <img src={frameUrl} alt="" className="frame-sm" decoding="async" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                </div>
                <div className="player-text">
                    <div className="player-name">{r.player.name}</div>
                    <div className="player-id-text">ID: {r.player.id}</div>
                </div>
            </div>
            <div className="total-score mobile-total">
                <div>{formatNumber(r.score)}<ScoreDelta delta={delta} /></div>
            </div>
            <MobileZoneBar zones={zones} r={r} delta={delta} />
        </>
    );
}
```

4. `RankingRowBase` 内：

```jsx
if (isMobile) {
    return (
        <div
            className={`ranking-row ranking-row-mobile${topN ? ` top-${displayRank}-row` : ''}`}
            style={style}
            onClick={() => onOpenMobileRow && onOpenMobileRow(r)}
        >
            <MobileRow
                r={r}
                zones={zones}
                delta={delta}
                topN={topN}
                displayRank={displayRank}
                portraitUrl={portraitUrl}
                frameUrl={frameUrl}
                onOpenPlayer={onOpenPlayer}
            />
        </div>
    );
}
```

5. `TeamCompareTag` 改为导出（`export function TeamCompareTag`，供 PlayerRankModal 复用，原文件内引用不受影响）。

- [ ] **步骤 3：CSS 断点（ranking.css 末尾追加）**

```css
/* ========== 排行榜移动端（与 JS matchMedia 700px 一致） ========== */
@media (max-width: 700px) {
    .ranking-row { padding: 10px 12px; flex-wrap: wrap; row-gap: 6px; }
    .ranking-row-mobile { cursor: pointer; }
    .ranking-row-mobile:active { background: var(--row-hover); }
    .ranking-row-mobile .rank-num { width: 56px; font-size: 13px; }
    .ranking-row-mobile .rank-medal { width: 24px; height: 24px; font-size: 12px; }
    .ranking-row-mobile .ranking-player { width: auto; flex: 1; min-width: 0; gap: 8px; }
    .ranking-row-mobile .player-avatar-sm { width: 36px; height: 36px; }
    .ranking-row-mobile .player-avatar-sm img { width: 36px; height: 36px; }
    .ranking-row-mobile .player-avatar-sm .frame-sm { width: 42px; height: 42px; top: -3px; left: -3px; }
    .ranking-row-mobile .player-name { font-size: 13px; }
    .ranking-row-mobile .player-id-text { font-size: 10px; }
    .ranking-row-mobile .mobile-total { width: auto; font-size: 13px; }
    .ranking-row-mobile .mobile-total .score-delta-up,
    .ranking-row-mobile .mobile-total .score-delta-down,
    .ranking-row-mobile .mobile-total .score-delta-same { font-size: 9px; }
    .mobile-zone-bar {
        display: flex;
        width: 100%;
        gap: 6px;
    }
    .mobile-zone-seg {
        flex: 1;
        min-width: 0;
        background: var(--surface);
        border: 0.5px solid var(--border-soft);
        border-radius: 8px;
        padding: 6px 8px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
    }
    .mobile-zone-name { font-size: 10px; color: var(--text-3); }
    .mobile-zone-score { font-size: 12px; font-weight: 600; color: var(--text); font-variant-numeric: tabular-nums; }
    .mobile-zone-score .score-delta-up,
    .mobile-zone-score .score-delta-down,
    .mobile-zone-score .score-delta-same { font-size: 9px; }
    .zone-actions { position: static; opacity: 1; visibility: visible; }
    .ranking-row:hover .zone-actions .zone-sa-btn { opacity: 1; }
}
```

> 注意：`.ranking-row-mobile` 断点内，桌面 `.zone-detail`（三区单元格）在手机分支不渲染，无需隐藏。`.zone-actions` 常显规则同时满足设计文档"hover 常显"要求。

- [ ] **步骤 4：验证**

运行：`npm run build`
预期：构建成功

运行：`npm run dev`，浏览器 DevTools 375px 视口打开 `http://localhost:5173`，确认：
- 行呈紧凑卡片式（排名/头像名/总分/三区分数条）
- 无横向滚动条（`document.documentElement.scrollWidth <= 375`）
- 缩小到 1440px 时恢复桌面表格

- [ ] **步骤 5：Commit**

```bash
git add src/components/Ranking/VirtualRankingTable.jsx src/components/Ranking/RankingRow.jsx src/styles/ranking.css
git commit -m "feat: 排行榜手机紧凑行——matchMedia 联动行高列宽，三区分数条替代三区单元格"
```

---

### 任务 5：PlayerRankModal 二级弹窗（新组件）

**文件：**
- 创建：`src/components/Modals/PlayerRankModal.jsx`
- 修改：`src/styles/modals.css`（末尾追加样式）
- 修改：`src/components/Ranking/RankingPanel.jsx`
- 修改：`src/components/Ranking/VirtualRankingTable.jsx`（传 onOpenMobileRow）

- [ ] **步骤 1：创建 PlayerRankModal**

```jsx
import React, { useState } from 'react';
import Modal from './Modal.jsx';
import { getImageUrl } from '../../api/config.js';
import { formatNumber, formatScoreCompact, getQualityInfo, getTeamKey } from '../../utils/format.js';
import { getRankDelta } from '../../utils/ranking.js';
import { TeamCompareTag } from '../Ranking/RankingRow.jsx';

// 手机端排行榜行二级弹窗：玩家头 + 三区 tab（复用 TeamCompareTag / SaModal 单区结构）
export default function PlayerRankModal({ ranking, rankings, zones, prevSnapshot, onClose, onOpenPlayer, onOpenAnalysis, onOpenTrend }) {
    const [activeZone, setActiveZone] = useState(0);
    const r = ranking;
    const zone = zones[activeZone];
    const zd = r.zones ? r.zones.find(z => z.id === zone.id) : null;
    const delta = getRankDelta(r.player.id, r.rank, r.score, prevSnapshot);
    const portraitUrl = r.player.portrait ? getImageUrl(r.player.portrait) : '';
    const frameUrl = r.player.frame ? getImageUrl(r.player.frame) : '';

    return (
        <Modal title={r.player.name} sub={`ID: ${r.player.id} · 排名第${r.rank}`} onClose={onClose}>
            <div className="prm-header">
                <div className="player-avatar-sm prm-avatar">
                    {portraitUrl && <img src={portraitUrl} alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                    {frameUrl && <img src={frameUrl} alt="" className="frame-sm" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                </div>
                <div className="prm-total">
                    <span className="prm-total-label">总分</span>
                    <span className="prm-total-val">{formatNumber(r.score)}</span>
                    {delta && (() => {
                        if (delta.scoreDelta > 0) return <span className="score-delta-up">+{formatScoreCompact(delta.scoreDelta)}</span>;
                        if (delta.scoreDelta < 0) return <span className="score-delta-down">-{formatScoreCompact(Math.abs(delta.scoreDelta))}</span>;
                        return <span className="score-delta-same">0</span>;
                    })()}
                </div>
            </div>

            <div className="prm-tabs">
                {zones.map((z, i) => (
                    <button
                        key={z.id}
                        className={`prm-tab${i === activeZone ? ' active' : ''}`}
                        onClick={() => setActiveZone(i)}
                    >
                        {z.name}
                    </button>
                ))}
            </div>

            {!zd || !zd.characters || zd.characters.length === 0 ? (
                <div className="sa-empty">该玩家此区无上榜数据</div>
            ) : (
                <div className="prm-zone">
                    <div className="sa-zone-title">
                        第{activeZone + 1}区分数 <span className="sa-zone-score">{formatNumber(zd.score)}分</span>
                    </div>
                    <div className="prm-chars">
                        {zd.characters.map((c, i) => (
                            <div className="sa-char" key={i}>
                                {c.icon && <img src={getImageUrl(c.icon)} alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />}
                                <span>{c.characterName}</span>
                                {getQualityInfo(c.rank) && <em className={`rank-quality-sm quality-${c.rank}`}>{getQualityInfo(c.rank)}</em>}
                                {c.cubIcon && <img className="cub-icon-sm" src={getImageUrl(c.cubIcon)} alt="" title={c.cubName || ''} onError={e => { e.currentTarget.style.display = 'none'; }} />}
                            </div>
                        ))}
                    </div>
                    <div className="prm-compare"><TeamCompareTag zd={zd} teamMax={undefined} zone={zone} /></div>
                    <div className="prm-actions">
                        <button className="zone-sa-btn" onClick={() => onOpenAnalysis(r.player.id, activeZone)}>分析</button>
                        <button className="zone-sa-btn zone-trend-btn" onClick={() => onOpenTrend(r.player.id, activeZone)}>趋势</button>
                    </div>
                </div>
            )}

            <button className="prm-goto" onClick={() => { onClose(); onOpenPlayer(r.player.id); }}>前往玩家页</button>
        </Modal>
    );
}
```

> 说明：`TeamCompareTag` 需要 `teamMax`，桌面版由 `computeTeamMaxScores(rows, zones)` 计算并传下行。PlayerRankModal 中同样在 RankingPanel 计算后传入（见步骤 3），弹窗内 `teamMax` 为必传 prop，勿传 undefined。

- [ ] **步骤 2：弹窗样式（modals.css 末尾追加）**

```css
/* ========== PlayerRankModal ========== */
.prm-header { display: flex; align-items: center; gap: 12px; padding: 4px 0 12px; }
.prm-avatar { width: 48px; height: 48px; }
.prm-avatar img { width: 48px; height: 48px; }
.prm-avatar .frame-sm { width: 54px; height: 54px; }
.prm-total { display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; }
.prm-total-label { font-size: 12px; color: var(--text-3); }
.prm-total-val { font-size: 18px; font-weight: 700; color: var(--text); font-variant-numeric: tabular-nums; }
.prm-tabs { display: flex; gap: 6px; margin-bottom: 12px; }
.prm-tab {
    flex: 1;
    min-height: 40px;
    border: 0.5px solid var(--border-soft);
    background: var(--surface);
    color: var(--text-2);
    border-radius: 10px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
}
.prm-tab.active { background: var(--accent); color: var(--accent-text); }
.prm-zone { margin-bottom: 12px; }
.prm-chars { display: flex; flex-direction: column; gap: 8px; margin: 10px 0; }
.prm-compare { margin: 4px 0 10px; }
.prm-actions { display: flex; gap: 8px; }
.prm-actions .zone-sa-btn { position: static; opacity: 1; visibility: visible; margin: 0; }
.prm-goto {
    width: 100%;
    min-height: 44px;
    border: none;
    border-radius: 10px;
    background: var(--accent);
    color: var(--accent-text);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
}
```

- [ ] **步骤 3：RankingPanel 挂载 PlayerRankModal**

修改 `src/components/Ranking/RankingPanel.jsx`：

1. 顶部 import：`const PlayerRankModal = lazy(() => import('../Modals/PlayerRankModal.jsx'));`
2. 新增 state：`const [playerRankTarget, setPlayerRankTarget] = useState(null); // { ranking }`
3. `openMobileRow` 回调：

```jsx
const openMobileRow = useCallback(ranking => {
    setPlayerRankTarget(ranking);
}, []);
```

4. 传给 VirtualRankingTable：`onOpenMobileRow={openMobileRow}`
5. Suspense 内挂载：

```jsx
{playerRankTarget && (
    <PlayerRankModal
        ranking={playerRankTarget}
        rankings={rankings}
        zones={zones}
        prevSnapshot={prevSnapshot}
        teamMax={rk ? rk.teamMax : undefined}
        onClose={() => setPlayerRankTarget(null)}
        onOpenPlayer={onOpenPlayer}
        onOpenAnalysis={openAnalysis}
        onOpenTrend={openTrend}
    />
)}
```

> 注意：`rk.teamMax` 若在 useRankings 中不存在，需在 RankingPanel 用 `computeTeamMaxScores(rk.filtered, zones)` 计算（import 自 `../../utils/ranking.js`）。PlayerRankModal 的 props 中增加 `teamMax`，`<TeamCompareTag zd={zd} teamMax={teamMax} zone={zone} />`。

- [ ] **步骤 4：验证**

运行：`npm run build`
预期：构建成功

运行：`npm run dev`，375px 视口：
- 点击排行榜任意行 → PlayerRankModal 弹出（玩家头/总分/三区 tab/阵容/分析/趋势/前往玩家页）
- tab 切换三区内容正确
- "分析/趋势"按钮分别打开 SaModal / CurveModal
- "前往玩家页"关闭弹窗并跳转玩家页

- [ ] **步骤 5：Commit**

```bash
git add src/components/Modals/PlayerRankModal.jsx src/styles/modals.css src/components/Ranking/RankingPanel.jsx src/components/Ranking/VirtualRankingTable.jsx src/components/Ranking/RankingRow.jsx
git commit -m "feat: PlayerRankModal 二级弹窗——玩家头+三区tab承接手机端行详情"
```

---

### 任务 6：排行榜头部区手机布局（控制区/表头/工具栏/筛选折叠）

**文件：**
- 修改：`src/components/Ranking/RankingHeader.jsx`
- 修改：`src/components/Ranking/RankingControls.jsx`（仅确认类名，可能无需改）
- 修改：`src/styles/ranking.css`（末尾追加）

- [ ] **步骤 1：RankingHeader 手机折叠筛选**

`RankingHeader` 接收新增 prop `isMobile`。整文件修改为：桌面渲染不变；`isMobile` 时渲染折叠面板：

```jsx
function MobileFilterPanel({ zones, charFilters, setCharFilter, setZoneQuick, onReset }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="mobile-filter">
            <button className="mobile-filter-toggle" onClick={() => setOpen(o => !o)}>
                筛选 {open ? '▴' : '▾'}
            </button>
            {open && (
                <div className="mobile-filter-body">
                    {zones.map((zone, i) => (
                        <div className="mobile-filter-zone" key={zone.id}>
                            <div className="mobile-filter-zone-name">{zone.name}</div>
                            <div className="char-slot-filters">
                                {[0, 1, 2].map(ci => (
                                    <select
                                        key={ci}
                                        className="char-slot-select"
                                        value={(charFilters[i] || ['', '', ''])[ci] || ''}
                                        onChange={e => setCharFilter(i, ci, e.target.value)}
                                    >
                                        {RANK_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </select>
                                ))}
                            </div>
                            <div className="zone-quick-filters">
                                <button className="zone-quick-btn" onClick={() => setZoneQuick(i, '5')}>全SSS</button>
                                <button className="zone-quick-btn" onClick={() => setZoneQuick(i, '6')}>全SSS+</button>
                            </div>
                        </div>
                    ))}
                    <button className="reset-filter-btn" onClick={onReset}>重置筛选</button>
                </div>
            )}
        </div>
    );
}
```

组件顶部：

```jsx
import React, { useState } from 'react';
...
export default function RankingHeader({ zones, charFilters, setCharFilter, setZoneQuick, sortKey, sortAsc, toggleSort, onReset, isMobile }) {
    if (isMobile) {
        return <MobileFilterPanel zones={zones} charFilters={charFilters} setCharFilter={setCharFilter} setZoneQuick={setZoneQuick} onReset={onReset} />;
    }
    ... 桌面原逻辑不变 ...
}
```

- [ ] **步骤 2：CSS（ranking.css 末尾追加）**

```css
@media (max-width: 700px) {
    .mobile-filter { padding: 8px 12px; border-bottom: 0.5px solid var(--border-soft); }
    .mobile-filter-toggle {
        width: 100%;
        min-height: 40px;
        border: none;
        background: transparent;
        color: var(--text-2);
        font-size: 13px;
        font-weight: 600;
        text-align: left;
        cursor: pointer;
        border-radius: 8px;
    }
    .mobile-filter-toggle:hover { background: var(--row-hover); }
    .mobile-filter-body { display: flex; flex-direction: column; gap: 10px; padding: 8px 0 4px; }
    .mobile-filter-zone { border: 0.5px solid var(--border-soft); border-radius: 10px; padding: 8px; }
    .mobile-filter-zone-name { font-size: 12px; font-weight: 600; color: var(--text-2); margin-bottom: 6px; }
    .mobile-filter-zone .char-slot-filters { display: flex; gap: 6px; margin-bottom: 6px; }
    .mobile-filter-zone .char-slot-select { flex: 1; font-size: 12px; min-height: 36px; }
    .mobile-filter-zone .zone-quick-filters { display: flex; gap: 6px; }
    .mobile-filter-zone .zone-quick-btn { flex: 1; min-height: 36px; }
    .mobile-filter .reset-filter-btn { width: 100%; min-height: 40px; font-size: 13px; }

    /* 控制区纵向堆叠 */
    .ranking-head { flex-direction: column; gap: 6px; }
    .ranking-controls { flex-wrap: wrap; }
    .ranking-controls select { flex: 1 1 45%; min-height: 40px; font-size: 13px; }
    .ranking-controls .date-range { width: 100%; font-size: 11px; }
    .ranking-meta { font-size: 11px; flex-wrap: wrap; }

    /* 工具栏压缩 */
    .ranking-toolbar { flex-wrap: wrap; gap: 6px; }
    .ranking-toolbar input { flex: 1 1 100%; min-height: 40px; font-size: 13px; }
    .ranking-toolbar button { min-height: 40px; font-size: 12px; padding: 0 12px; }

    /* 标题行 */
    .rankings h2 { font-size: 15px; }
    .refresh-btn { min-height: 40px; }

    .filter-hint { font-size: 11px; }
}
```

> 需先确认 ranking.css 中工具栏实际类名（`.ranking-toolbar` 或 `.toolbar`），以现有类名为准，若不匹配则修正选择器。`RankingToolbar.jsx:18` 内容很短，实现时打开确认。

- [ ] **步骤 3：RankingPanel 传 isMobile 给 header**

`VirtualRankingTable.jsx` 中 header 由 RankingPanel 构造传入——把 `isMobile` 从 `VirtualRankingTable` 透传不可行（header 是 ReactNode）。改为：RankingPanel 内也用 `useMediaQuery(MOBILE_QUERY)`，构造 header 时 `isMobile={isMobile}`：

```jsx
import useMediaQuery, { MOBILE_QUERY } from '../../hooks/useMediaQuery.js';
// 组件内：
const isMobile = useMediaQuery(MOBILE_QUERY);
// header 构造处：
<RankingHeader ... isMobile={isMobile} />
```

- [ ] **步骤 4：验证**

运行：`npm run build`；dev server 375px：筛选折叠展开/收起、难度/周下拉可用、搜索框全宽、刷新按钮可点、桌面 1440px 恢复原样。

- [ ] **步骤 5：Commit**

```bash
git add src/components/Ranking/RankingHeader.jsx src/components/Ranking/RankingPanel.jsx src/styles/ranking.css
git commit -m "feat: 排行榜头部手机布局——筛选折叠面板、控制区堆叠、工具栏压缩"
```

---

### 任务 7：玩家查询页手机适配

**文件：**
- 修改：`src/styles/pages.css`（末尾追加 560px 断点段）

- [ ] **步骤 1：追加断点样式**

```css
/* ========== 玩家查询页移动端 ========== */
@media (max-width: 560px) {
    .search-box { gap: 8px; }
    .search-box input { min-height: 44px; font-size: 14px; flex: 1; }
    .search-box button { min-height: 44px; font-size: 14px; padding: 0 16px; }
    .history-item, .follow-item { padding: 10px 8px; gap: 10px; }
    .history-avatar, .follow-avatar { width: 32px; height: 32px; }
    .history-name, .follow-name { font-size: 12px; }
    .history-id, .follow-id { font-size: 10px; }
    .player-profile { flex-direction: row; gap: 12px; padding: 12px; }
    .player-avatar { width: 64px; height: 64px; }
    .player-avatar img { width: 64px; height: 64px; }
    .player-actions { flex-wrap: wrap; }
    .player-actions .bind-set-btn { min-height: 40px; }
    .characters-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
    .character-card { padding: 8px; }
    .character-icon { height: 72px; }
    .character-name { font-size: 12px; }
    .follow-actions .bind-set-btn, .follow-actions .follow-view, .follow-actions .follow-remove { min-height: 40px; font-size: 12px; }
}
```

> 需先核对 pages.css 中实际类名（`.bind-set-btn`/`.follow-view` 等），以现有为准。`.characters-grid` 若已有 `auto-fill minmax(160px,1fr)`，此覆盖为 2 列固定。

- [ ] **步骤 2：验证**

运行：`npm run build`；dev server 375px 查询一个玩家（可用排行榜跳转），检查：搜索/历史/玩家头/角色卡/关注列表无溢出，按钮可点。

- [ ] **步骤 3：Commit**

```bash
git add src/styles/pages.css
git commit -m "feat: 玩家查询页手机适配——44px 触控、角色卡双列、玩家头精简"
```

---

### 任务 8：幻痛囚笼页手机适配

**文件：**
- 修改：`src/components/PpcPage.jsx`
- 修改：`src/styles/pages.css`

- [ ] **步骤 1：PpcPage 内联宽度改类名**

`PpcPage.jsx:138` 与 `:142` 的 `style={{ width: 80 }}` / `style={{ width: 220 }}` 改为不加内联（或保留但 CSS 覆盖会失效——必须移除内联）：

- 行根元素（`:137`）加 `className="ranking-row ppc-row"`（替换原 `ranking-row`）
- 移除 `style={{ width: 80 }}` → 靠 CSS 默认 `.rank-num { width: 80px }` 即可，手机断点内覆盖为 56px
- 移除 `style={{ width: 220 }}`，在 pages.css 增加 `.ppc-row .ranking-player { width: 220px; }` 保持桌面一致

- [ ] **步骤 2：追加断点样式（pages.css 末尾）**

```css
/* ========== 幻痛囚笼页移动端 ========== */
@media (max-width: 560px) {
    .ppc-bosses { grid-template-columns: repeat(2, 1fr); gap: 8px; }
    .ppc-boss-card { min-height: 0; padding: 8px; }
    .ppc-boss-card img { height: 56px; }
    .ppc-boss-card span { font-size: 12px; }
    .ppc-row .rank-num { width: 56px; font-size: 13px; }
    .ppc-row .ranking-player { width: auto; flex: 1; min-width: 0; gap: 8px; }
    .ppc-row .player-avatar-sm { width: 32px; height: 32px; }
    .ppc-row .player-avatar-sm img { width: 32px; height: 32px; }
    .ppc-row .player-name { font-size: 13px; }
    .ppc-row .total-score { font-size: 13px; }
    .ppc-ranking .ranking-header .col-rank { width: 56px; }
    .ppc-ranking .ranking-header .col-player { width: auto; flex: 1; }
    .ppc-ranking .ranking-header .col-total { width: 110px; }
}
```

> 核对 pages.css 中 `.ppc-bosses` 现有 grid 定义与 `.ranking-table.ppc-ranking` 表头类名后调整。

- [ ] **步骤 3：验证**

运行：`npm run build`；375px：boss 卡两列、TOP100 行紧凑、表头对齐、无溢出；1440px 无回归。

- [ ] **步骤 4：Commit**

```bash
git add src/components/PpcPage.jsx src/styles/pages.css
git commit -m "feat: 幻痛囚笼页手机适配——内联宽度改类、boss 卡双列、榜单行紧凑"
```

---

### 任务 9：我的页手机适配

**文件：**
- 修改：`src/components/MinePage.jsx`
- 修改：`src/styles/pages.css`

- [ ] **步骤 1：ScoreTable 包横滚容器**

`MinePage.jsx:109` 的 `<table className="score-table">` 外包一层：

```jsx
<div className="table-scroll">
    <table className="score-table"> ... </table>
</div>
```

- [ ] **步骤 2：追加断点样式（pages.css 末尾）**

```css
/* ========== 我的页移动端 ========== */
@media (max-width: 560px) {
    .table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .score-table { min-width: 640px; font-size: 12px; }
    .setup-guide .guide-steps { flex-direction: column; gap: 8px; }
    .setup-guide .guide-step { width: 100%; padding: 10px 12px; }
    .guide-action { min-height: 40px; font-size: 12px; }
    .mine-section { padding: 12px; }
    .mine-section-header h3 { font-size: 14px; }
    .mine-section input, .mine-section select, .mine-section button { min-height: 44px; }
    .mine-section form { flex-direction: column; }
    .mine-section form .bind-set-btn { width: 100%; }
    .week-score-card .mine-section-header { flex-wrap: wrap; }
    .score-total { white-space: nowrap; }
    .score-delete, .score-team-btn { min-height: 36px; }
}
```

> 注意：`.mine-section form` 纵向堆叠只影响表单类 section；`.score-table` 的 `min-width: 640px` 保证表格内部可横滚且容器不溢出页面。核对 MinePage 中表单实际结构（`.mine-section input/button` 组合方式）后微调选择器。

- [ ] **步骤 3：验证**

运行：`npm run build`；375px：历史记录表在容器内横滚（页面无横向溢出）、表单纵向、登录/绑定按钮可点。

- [ ] **步骤 4：Commit**

```bash
git add src/components/MinePage.jsx src/styles/pages.css
git commit -m "feat: 我的页手机适配——历史表横滚容器、表单纵向、44px 触控"
```

---

### 任务 10：更新日志页检查 + 广告/反馈 + hover 常显收尾

**文件：**
- 修改：`src/styles/app.css`
- 修改：`src/styles/pages.css`
- 修改：`src/styles/zone.css`

- [ ] **步骤 1：追加收尾样式**

app.css 末尾追加：

```css
/* ========== 移动端收尾 ========== */
@media (max-width: 560px) {
    .ad-float { width: min(340px, 88vw); }
    .corner-feedback { font-size: 10px; padding: 3px 10px; }
}
@media (max-width: 700px) {
    .zone-detail-btn, .bracket-btn, .clear-btn, .bind-set-btn {
        opacity: 1;
        visibility: visible;
    }
    .zone-card { padding: 10px; }
    .zone-card-actions { position: static; opacity: 1; visibility: visible; }
    .zones-container { gap: 8px; }
    .zone-name { font-size: 13px; }
    .zone-card-sub .zone-sub-chip { font-size: 10px; }
}
```

pages.css 末尾追加（更新日志页防护）：

```css
@media (max-width: 560px) {
    .changelog-timeline { padding: 0 4px; }
    .changelog-timeline .timeline-item { padding: 8px; font-size: 13px; }
}
```

> 核对 `.changelog-timeline` 实际类名（ChangelogPage.jsx 中确认）后调整；若不存在该结构则只保留断点内字号微调或删除此段。

- [ ] **步骤 2：全站 hover 常显盘点**

用 grep 在 `src/styles/*.css` 检索 `:hover` 中带 `opacity: 0` 或 `visibility: hidden` 的选择器，逐一在 700px 断点内补 `opacity: 1; visibility: visible;`。

- [ ] **步骤 3：验证**

运行：`npm run build`；375px：广告宽度正常、反馈按钮不挡内容、区卡详情按钮常显可点。

- [ ] **步骤 4：Commit**

```bash
git add src/styles/app.css src/styles/pages.css src/styles/zone.css
git commit -m "feat: 手机端收尾——广告88vw、反馈小字、hover 元素常显"
```

---

### 任务 11：ChangelogPage 内容适配确认

**文件：**
- 修改：`src/components/ChangelogPage.jsx`（如发现硬编码宽度/表格）
- 修改：`src/styles/pages.css`

- [ ] **步骤 1：检查**

读 `src/components/ChangelogPage.jsx`（134 行）与对应 CSS，确认无固定宽度/表格/横排结构。
若有固定宽度元素，改为 `max-width: 100%`。

- [ ] **步骤 2：验证**

375px 视口打开更新日志页，确认文本不溢出（如无问题此任务仅检查+跳过 commit，把检查结论记入 commit message 为 `chore: changelog 页移动端检查通过` 或直接并入任务 10）。

- [ ] **步骤 3：Commit（仅在代码有改动时）**

```bash
git add src/components/ChangelogPage.jsx src/styles/pages.css
git commit -m "chore: 更新日志页移动端检查/微调"
```

---

### 任务 12：Playwright 双视口回归脚本

**文件：**
- 创建：`scripts/mobile-check.mjs`
- 修改：`package.json`

- [ ] **步骤 1：安装 Playwright**

```bash
npm i -D playwright
npx playwright install chromium
```

- [ ] **步骤 2：创建回归脚本**

```js
// scripts/mobile-check.mjs
// 用法：node scripts/mobile-check.mjs [baseUrl]  （默认 http://localhost:4173，需先 npm run preview）
import { chromium } from 'playwright';

const base = process.argv[2] || 'http://localhost:4173';
const PAGES = ['', '#/player', '#/ppc', '#/mine', '#/changelog'];
const VIEWPORTS = [
    { name: 'mobile-375', width: 375, height: 812 },
    { name: 'desktop-1440', width: 1440, height: 900 }
];

const browser = await chromium.launch();
let failures = 0;
for (const vp of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    for (const hash of PAGES) {
        const url = base + '/' + hash;
        await page.goto(url, { waitUntil: 'networkidle' });
        await page.waitForTimeout(800);
        const result = await page.evaluate(() => {
            const dw = document.documentElement.scrollWidth;
            const iw = window.innerWidth;
            return { dw, iw, overflow: dw > iw + 1 };
        });
        const tag = `${vp.name} ${hash || '/'}`;
        if (result.overflow) {
            failures++;
            console.log(`FAIL ${tag}: scrollWidth=${result.dw} > innerWidth=${result.iw}`);
        } else {
            console.log(`ok   ${tag}: ${result.dw}px`);
        }
    }
    await page.close();
}
await browser.close();
if (failures > 0) {
    console.log(`\n${failures} 个页面存在横向溢出`);
    process.exit(1);
}
console.log('\n全部页面无横向溢出');
```

package.json scripts 追加：

```json
"check:mobile": "node scripts/mobile-check.mjs"
```

- [ ] **步骤 3：跑回归**

```bash
npm run build
npm run preview
```

另开终端：

```bash
npm run check:mobile
```

预期：全部 `ok`，无 `FAIL`。若有 FAIL，定位溢出元素（DevTools 检查 scrollWidth 来源）并修复后重跑。

- [ ] **步骤 4：交互点验（手动，375px）**

- 排行榜：筛选展开→选阶级→行点击开 PlayerRankModal→tab 切换→分析/趋势→前往玩家页
- 玩家查询：搜索→角色卡→角色详情弹窗→历史战绩弹窗
- PPC：级别切换→boss 详情
- 我的：登录表单、分数录入、历史表横滚、趋势图
- 桌面 1440px 抽验排行榜表格布局与弹窗

- [ ] **步骤 5：Commit**

```bash
git add scripts/mobile-check.mjs package.json package-lock.json
git commit -m "test: Playwright 双视口回归脚本（375/1440 横向溢出检查）"
```

---

### 任务 13：Electron 桌面端适配确认

**文件：**
- 检查：`electron-main.js` / `electron-preload.js`（预计无需修改）

- [ ] **步骤 1：确认窗口最小宽度**

`electron-main.js` 中 BrowserWindow 若有 `minWidth/minHeight` 或固定 `width/height`，保持 ≥1024 默认即可；若无则不改。Electron 桌面窗口宽于 700px 时走桌面布局，本计划所有断点均不触发，无需处理。

- [ ] **步骤 2：验证**

运行：`npm run electron:win`（或已装好的 `release/win-unpacked` 内可执行文件）启动桌面版，确认布局与适配前一致。

- [ ] **步骤 3：Commit（无改动则跳过）**

---

### 任务 14：最终回归与收尾

**文件：** 全仓库

- [ ] **步骤 1：完整回归**

```bash
npm run build
npm run preview
npm run check:mobile
```

- [ ] **步骤 2：桌面回归（DevTools 1440px 或 Electron）**

抽查：排行榜列宽/表头/筛选、弹窗、玩家页、我的页表格，确认与适配前一致。

- [ ] **步骤 3：更新交接文档**

在 `docs/交接文档.md` 手机端 UI 整改小节（第 153-161 行附近）勾选完成项：移动端布局（375px）、PlayerRankModal、弹窗全屏、hover 常显、广告 88vw、Playwright 回归通过。`docs/移动端适配设计.md` 状态行改为"已实现"。

- [ ] **步骤 4：Commit**

```bash
git add docs/交接文档.md docs/移动端适配设计.md
git commit -m "docs: 手机端 UI 适配完成——交接文档更新"
```

---

## 自检记录

**规格覆盖度（对照 `docs/移动端适配设计.md` 各节）：**
- 一、现状诊断 → 任务 2-10 全部覆盖（导航/弹窗/表格/页面/hover）
- 二、设计原则 → 任务 4/5（首页收缩+二级弹窗）、任务 6（核心功能一屏可达）、任务 10（hover 常显）、触控 40px 贯穿
- 三、1 导航 → 任务 2；三、2 排行榜 → 任务 4/5/6；三、3 弹窗 → 任务 3；三、4 玩家页 → 任务 7；三、5 PPC → 任务 8；三、6 我的页 → 任务 9；三、7 广告反馈 → 任务 10；三、8 hover → 任务 6+10
- 四、技术要点 → 任务 1（matchMedia 监听）、任务 4（列宽联动）、任务 12（Playwright 375px 回归）
- 五、实现顺序 → 与任务顺序一致

**占位符扫描：** 无 TODO/待定；所有 CSS 均给出现成代码块。唯一开放点（工具栏/区卡实际类名）已在任务中标注"实现时核对"，因计划基于已读取源码，类名以 grep 结果为准（`.ranking-toolbar` 需实现时确认）。

**类型/签名一致性：** `useMediaQuery(MOBILE_QUERY)` 全站统一；`ROW_HEIGHT_MOBILE=96` 仅在 VirtualRankingTable 引用；`onOpenMobileRow(ranking)` 从 VirtualRankingTable → RankingRow → RankingPanel 单向传递；PlayerRankModal props（ranking/rankings/zones/prevSnapshot/teamMax/onClose/onOpenPlayer/onOpenAnalysis/onOpenTrend）在任务 5 定义即全量使用。
