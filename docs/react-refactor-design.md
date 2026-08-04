# 含英牌战区数据工具 — React 重构设计文档

> 版本：v1（设计稿）
> 状态：待评审
> 目标：解决排行榜渲染性能瓶颈，为后续功能扩展打好组件化基础

---

## 一、背景与目标

### 现状问题
- 排行榜每次交互（筛选/排序/搜索/刷新）都是**全量 innerHTML 重建**：100 行 × 每行约 30 个 DOM 节点（3 区 × 3 角色 + 标签 + 按钮），一次交互重建约 3000+ 节点，交互有明显卡顿
- 所有逻辑集中在一个 3000+ 行的 `js/main.js`，状态分散在全局变量，维护成本高
- 图表为手写 SVG，能力有限（无图例、无 y 轴刻度体系、无动画）

### 重构目标
1. **性能**：排行榜改为虚拟滚动，只渲染可视行（~15 行），配合 React 局部更新
2. **可维护**：组件化拆分，状态集中管理
3. **图表升级**：迁移到 Recharts（shadcn 风格），复用现成图表组件能力
4. **功能 100% 保留**：现有 13+ 项功能全部平移

---

## 二、技术选型

| 项 | 选择 | 理由 |
|---|---|---|
| 框架 | React 18 + Vite 5 | 已有 Recharts/shadcn 组件是 React 生态，可直接复用 |
| 虚拟滚动 | react-window（FixedSizeList） | 轻量成熟，行高固定场景首选 |
| 图表 | Recharts + shadcn Chart 组件 | 用户提供过组件代码，曲线图/分布图直接套用 |
| 状态管理 | 组件 State + Context（不使用 Redux） | 页面级状态，数据流简单，避免引入重依赖 |
| 样式 | 迁移现有 style.css 变量体系（CSS 变量 + 普通 CSS） | 黑白灰主题变量已成熟，避免样式重写风险 |
| 构建部署 | Vite build → dist，Vercel 托管，Electron 加载 dist | 与现有架构一致 |

---

## 三、项目结构

```
huaxu国内版/
├── index.html            # Vite 入口（改造现有文件）
├── vite.config.js
├── package.json          # 增加 react/vite/recharts/react-window
├── electron-main.js      # 适配：开发加载 dev server，生产加载 dist
├── api/                  # Vercel Serverless（不动）
├── src/
│   ├── main.jsx          # 入口
│   ├── App.jsx           # 根组件：导航 + 页面路由切换
│   ├── styles/
│   │   ├── theme.css     # 现有变量体系迁移
│   │   └── components.css
│   ├── api/
│   │   ├── client.js     # fetch 封装（warzone/players/ppc）
│   │   ├── config.js     # API_CONFIG/IMAGE_PATHS（迁移自 js/config.js）
│   │   └── storage.js    # localStorage 封装（快照/曲线/主题/历史）
│   ├── hooks/
│   │   ├── useWarzone.js # 战区数据加载（难度/周切换、30 分钟刷新）
│   │   ├── useRankings.js# 筛选/排序/搜索状态与派生数据
│   │   └── useCurve.js   # 趋势曲线数据（采样记录 + 按天聚合）
│   ├── components/
│   │   ├── Nav.jsx
│   │   ├── Ranking/      # 排行榜（核心）
│   │   │   ├── RankingPanel.jsx      # 面板容器（毛玻璃）
│   │   │   ├── RankingControls.jsx   # 难度/周/日期/参与人数/更新时间
│   │   │   ├── RankingToolbar.jsx    # 搜索/分数分布/阵容参考/阵容排行
│   │   │   ├── RankingHeader.jsx     # 表头（列头 + 角色位筛选下拉）
│   │   │   ├── VirtualRankingTable.jsx # 虚拟滚动容器
│   │   │   └── RankingRow.jsx        # 行组件（memo 化）
│   │   ├── Modals/
│   │   │   ├── Modal.jsx             # 通用弹窗壳
│   │   │   ├── ZoneDetailModal.jsx
│   │   │   ├── BracketModal.jsx      # 分数分布（Recharts BarChart）
│   │   │   ├── TeamModal.jsx         # 阵容参考
│   │   │   ├── RankingModal.jsx      # 阵容排行（折叠列表）
│   │   │   ├── SaModal.jsx           # 单区分数分析
│   │   │   └── CurveModal.jsx        # 趋势曲线（Recharts LineChart）
│   │   ├── ZoneCards.jsx             # 战区卡片
│   │   ├── PlayerPage.jsx            # 玩家查询
│   │   ├── PpcPage.jsx               # 幻痛囚笼
│   │   └── MinePage.jsx              # 我的
│   └── utils/
│       ├── format.js    # formatNumber/formatScoreCompact/formatTime
│       ├── team.js      # getTeamKey/getTeamRankLabel/getQualityInfo
│       └── chart.js     # 图表数据准备
```

---

## 四、数据层设计

### API 客户端（src/api/client.js）
```js
// 统一封装，带超时与错误处理
fetchWithHeaders(url)
// 三个数据端点
loadWarzone(difficulty, week)   → { warzone, rankings, activities }
loadPlayer(playerId)
loadPpc(week)
```

### 状态流（useWarzone）
```
App 挂载
  ├─ 默认难度 16 / 本周 → loadWarzone
  ├─ 30 分钟定时刷新（仅本周）
  ├─ 切难度/切周 → 重新加载，重置排序/筛选
  └─ 加载完成：记录快照(30min 基线) + 记录曲线采样
```

### localStorage 存储（storage.js）
| Key | 用途 |
|---|---|
| `huaxu_wz_curve_{难度}_{周}` | 趋势曲线采样（版本化结构同现有） |
| `huaxu_wz_snap_{难度}` | 30 分钟排名对比快照 |
| `huaxu_theme` | 已废弃（固定浅色） |
| `huaxu_history` / `huaxu_follows` 等 | 玩家查询历史/关注 |

---

## 五、排行榜性能方案（核心）

### 5.1 问题拆解
- **筛选/排序/搜索**：纯派生数据 → 用 `useMemo` 计算过滤后数组，只有过滤结果变化才重渲染
- **行渲染**：100 行全量渲染 DOM 节点过多 → **虚拟滚动**只渲染可视行
- **行内更新**：行组件 `React.memo`，props 不变不重渲（排名差值更新时只重渲受影响行）

### 5.2 虚拟滚动设计
```
VirtualRankingTable
├─ 外层容器：overflow: auto（横向 + 纵向滚动）
├─ Sticky 表头：position: sticky（列头 + 每区角色位筛选下拉）
└─ 行虚拟化：
    └─ react-window FixedSizeList
         itemSize = 固定行高（150px，按现有行内容结构固定）
         height = 可视高度（containerHeight）
         width = 100%（横向滚动由外层容器负责）
         渲染 item = RankingRow（memo）
```

**行高固定依据**：每行结构固定——玩家信息（头像+名字+ID+公会，最多 4 行）+ 3 区列（每区：分数 + 标签/按钮 + 3 角色行），内容高度恒定 → 固定行高可行。

**列布局**：列全量渲染（不虚拟列），每行约 30 节点；可视 15 行 × 30 ≈ 450 节点，交互流畅。

### 5.3 交互状态（useRankings）
```js
// 单一状态对象 + useReducer（或 useState 组合）
{
  searchQuery,          // 搜索词
  charFilters: [[...]], // 每区 3 角色位阶级筛选
  sortKey,              // null | 'total' | 区索引
  sortAsc,
}
// 派生：
filteredRankings = useMemo(筛选 + 排序, [rankings, filters])
displayList = useMemo(取前 100, [filteredRankings])
```

---

## 六、图表方案（Recharts）

### 趋势曲线（CurveModal）
```
LineChart（Recharts）
├─ XAxis：今日 = 小时刻度；本周 = 周一~周日（数据按天聚合）
├─ YAxis：分数（紧凑格式刻度）
├─ Tooltip：自定义内容组件（shadcn ChartTooltipContent 样式）
├─ Line：平滑曲线（type="monotone"）+ 面积渐变填充
└─ ResponsiveContainer：自适应宽度
```
替换手写 SVG 方案，获得：动画、图例、刻度体系、缩放能力。

### 分数分布（BracketModal）
```
BarChart：总分/三区直方图（10 段），bar 颜色主题黑
```

---

## 七、样式方案

- 迁移 `css/style.css` 的 **CSS 变量体系**（`:root` 黑白灰变量）到 `src/styles/theme.css`
- 组件样式沿用现有类名（.ranking-table、.zone-card 等），按组件拆分文件
- 毛玻璃排行榜面板、色块渐变背景、广告浮动动画全部保留
- 新增样式随组件走，避免重复选择器

---

## 八、功能迁移清单（全功能保留）

| 功能 | 新组件 | 优先级 |
|---|---|---|
| 难度/周切换、日期、参与人数/更新时间 | RankingControls | P0 |
| 角色位筛选 + 全SSS/SSS+ + 重置 | RankingHeader | P0 |
| 搜索/排序（总分/各区） | useRankings + Header | P0 |
| 奖牌/前三行背景/总分最高标签 | RankingRow | P0 |
| 30 分钟排名差值（快照） | useRankings + RankingRow | P0 |
| 单区分数分析（同阶级最高分对比） | SaModal | P1 |
| 分析/趋势按钮（格子右上角） | RankingRow | P1 |
| 分数分布弹窗 | BracketModal（Recharts） | P1 |
| 阵容参考（最强/最常用） | TeamModal | P1 |
| 阵容排行（折叠 + 战力 + 搜索） | RankingModal | P1 |
| 趋势曲线（今日/本周 + 采样记录） | CurveModal（Recharts） | P1 |
| 战区卡片 + 详情 | ZoneCards | P1 |
| 玩家查询 + 历史战绩 | PlayerPage | P2 |
| 幻痛囚笼 | PpcPage | P2 |
| 我的（绑定/关注/评分/导入导出） | MinePage | P2 |
| 导航 + 站点信息 + 反馈入口 + 浮动广告 | App/Nav | P0 |

---

## 九、部署与 Electron

- **开发**：`vite dev`（端口 5173），Electron 开发模式加载 `http://localhost:5173`
- **生产**：`vite build` → `dist/`，Electron 加载 `dist/index.html`
- **Vercel**：保留 `api/` serverless 目录，静态资源来自 `dist/`（vite 构建输出）
- `vercel.json`：确认 `buildCommand`/`outputDirectory` 配置

---

## 十、迁移步骤（里程碑）

1. **M1 骨架**：Vite + React 初始化、路由/导航壳、主题变量迁移、数据层封装 → 页面可打开、数据可加载
2. **M2 排行榜核心**：虚拟滚动表格 + 筛选/排序/搜索 + 奖牌/差值/最高分标签 → 主交互可用
3. **M3 弹窗补齐**：6 个弹窗（Recharts 图表替换手写 SVG）
4. **M4 其他页面**：玩家查询/幻痛囚笼/我的
5. **M5 收尾**：Electron 适配、Vercel 构建验证、样式核对、性能对比验证（DevTools Performance）
6. **M6 合并**：功能验证通过后合并 main，删除旧 `js/`、`css/`（保留 api/）

### 验收标准
- 排行榜筛选/排序/搜索交互无卡顿（虚拟滚动生效，DOM 节点 < 500）
- 全部现有功能可用，无回归
- 黑白灰主题视觉一致
- `vite build` 通过，Electron 与 Vercel 均可正常运行
