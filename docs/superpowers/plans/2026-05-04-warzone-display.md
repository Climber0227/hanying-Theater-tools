# 战区数据展示网页 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 创建一个战双帕弥什战区数据展示网页，显示当前战区信息和全服排行榜

**架构：** 单页面HTML应用，直接调用API获取数据，使用CSS Grid/Flexbox布局，深色科技风格

**技术栈：** HTML5, CSS3, Vanilla JavaScript, Fetch API

---

## 文件结构

```
C:\Users\28135\Desktop\huaxu国内版\
├── index.html              # 主页面（创建）
├── css/
│   └── style.css          # 样式文件（创建）
└── js/
    └── main.js            # 主逻辑（创建）
```

## 文件职责

- `index.html`: 页面结构，引入CSS和JS
- `css/style.css`: 所有样式，深色科技主题
- `js/main.js`: API调用、数据处理、DOM渲染

---

### 任务 1：创建HTML基础结构

**文件：**
- 创建：`C:\Users\28135\Desktop\huaxu国内版\index.html`

- [ ] **步骤 1：创建HTML文件**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>战区数据</title>
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    <div class="container">
        <!-- 页面标题 -->
        <header class="header">
            <h1>战区数据</h1>
            <div class="meta">
                <span id="server">服务器: --</span>
                <span id="members">参与人数: --</span>
                <span id="updatedAt">更新时间: --</span>
            </div>
        </header>

        <!-- 战区卡片区域 -->
        <section class="zones-container" id="zonesContainer">
            <!-- 动态生成 -->
        </section>

        <!-- 分隔线 -->
        <div class="divider"></div>

        <!-- 排行榜 -->
        <section class="rankings">
            <h2>排行榜 <span class="top-label">TOP 100</span></h2>
            <div class="ranking-table" id="rankingTable">
                <!-- 动态生成 -->
            </div>
        </section>
    </div>

    <script src="js/main.js"></script>
</body>
</html>
```

- [ ] **步骤 2：验证文件创建**

运行：`ls -la "C:\Users\28135\Desktop\huaxu国内版\index.html"`
预期：文件存在

- [ ] **步骤 3：Commit**

```bash
cd "C:\Users\28135\Desktop\huaxu国内版"
git init
git add index.html
git commit -m "feat: 创建HTML基础结构"
```

---

### 任务 2：创建CSS样式

**文件：**
- 创建：`C:\Users\28135\Desktop\huaxu国内版\css\style.css`

- [ ] **步骤 1：创建CSS文件**

```css
/* 基础样式 */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
    background: linear-gradient(135deg, #0a0a1a 0%, #1a1a3a 100%);
    color: #fff;
    min-height: 100vh;
    padding: 20px;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
}

/* 页面标题 */
.header {
    text-align: center;
    margin-bottom: 30px;
}

.header h1 {
    color: #00d4ff;
    font-size: 32px;
    margin-bottom: 10px;
}

.meta {
    color: #888;
    font-size: 14px;
    display: flex;
    justify-content: center;
    gap: 20px;
}

/* 战区卡片区域 */
.zones-container {
    display: flex;
    gap: 15px;
    margin-bottom: 30px;
}

/* 普通战区卡片 */
.zone-card {
    flex: 1;
    background: rgba(0, 0, 0, 0.3);
    padding: 20px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.zone-card.fire {
    background: rgba(255, 107, 0, 0.15);
    border-color: rgba(255, 107, 0, 0.3);
}

.zone-card.physical {
    background: rgba(0, 150, 255, 0.15);
    border-color: rgba(0, 150, 255, 0.3);
}

.zone-card.thunder {
    background: rgba(150, 0, 255, 0.15);
    border-color: rgba(150, 0, 255, 0.3);
}

.zone-name {
    font-size: 20px;
    font-weight: bold;
    margin-bottom: 12px;
}

.zone-card.fire .zone-name { color: #ff6b00; }
.zone-card.physical .zone-name { color: #0096ff; }
.zone-card.thunder .zone-name { color: #9600ff; }

.zone-desc {
    color: #888;
    font-size: 13px;
    margin-bottom: 15px;
}

.zone-info {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 10px;
}

.zone-info:last-child {
    margin-bottom: 0;
}

.info-label {
    font-size: 12px;
    font-weight: bold;
    margin-bottom: 6px;
}

.zone-card.fire .info-label { color: #ff6b00; }
.zone-card.physical .info-label { color: #0096ff; }
.zone-card.thunder .info-label { color: #9600ff; }

.info-desc {
    color: #ccc;
    font-size: 11px;
    line-height: 1.5;
}

/* 混合区 */
.mixed-zone {
    flex: 2;
    border: 2px solid rgba(150, 0, 255, 0.5);
    border-radius: 12px;
    padding: 18px;
    background: rgba(150, 0, 255, 0.05);
}

.mixed-zone-header {
    color: #9600ff;
    font-size: 18px;
    font-weight: bold;
    text-align: center;
    margin-bottom: 15px;
    padding-bottom: 10px;
    border-bottom: 1px solid rgba(150, 0, 255, 0.3);
}

.mixed-zone-header .tag {
    font-size: 12px;
    color: #ff6b00;
    margin-left: 8px;
}

.mixed-zone-content {
    display: flex;
    gap: 12px;
}

.mixed-zone-card {
    flex: 1;
    background: rgba(150, 0, 255, 0.15);
    padding: 16px;
    border-radius: 8px;
    border: 1px solid rgba(150, 0, 255, 0.3);
}

.mixed-zone-card .zone-name {
    font-size: 16px;
    color: #9600ff;
}

/* 分隔线 */
.divider {
    height: 2px;
    background: linear-gradient(90deg, transparent, #00d4ff, transparent);
    margin: 30px 0;
}

/* 排行榜 */
.rankings h2 {
    color: #00d4ff;
    font-size: 22px;
    margin-bottom: 20px;
}

.top-label {
    font-size: 14px;
    color: #888;
    font-weight: normal;
}

.ranking-table {
    background: rgba(0, 0, 0, 0.3);
    border-radius: 12px;
    overflow: hidden;
}

.ranking-header {
    display: flex;
    padding: 15px 20px;
    background: rgba(0, 212, 255, 0.1);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    font-size: 13px;
    font-weight: bold;
}

.ranking-header .col-rank { width: 60px; color: #00d4ff; }
.ranking-header .col-player { flex: 1; color: #00d4ff; }
.ranking-header .col-zone { width: 100px; color: #00d4ff; text-align: center; }
.ranking-header .col-score { width: 120px; color: #00d4ff; text-align: right; }

.ranking-row {
    display: flex;
    padding: 15px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    align-items: center;
    font-size: 14px;
    transition: background 0.2s;
}

.ranking-row:hover {
    background: rgba(0, 212, 255, 0.05);
}

.ranking-row:last-child {
    border-bottom: none;
}

.rank-num {
    width: 60px;
    font-weight: bold;
    color: #888;
}

.rank-num.top-1 { color: #ffd700; }
.rank-num.top-2 { color: #c0c0c0; }
.rank-num.top-3 { color: #cd7f32; }

.player-info {
    flex: 1;
}

.player-name {
    color: #fff;
    font-weight: bold;
    margin-bottom: 4px;
}

.guild-name {
    color: #666;
    font-size: 12px;
}

.zone-tag {
    width: 100px;
    text-align: center;
}

.zone-badge {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 15px;
    font-size: 12px;
}

.zone-badge.fire {
    background: rgba(255, 107, 0, 0.3);
    color: #ff6b00;
}

.zone-badge.physical {
    background: rgba(0, 150, 255, 0.3);
    color: #0096ff;
}

.zone-badge.thunder {
    background: rgba(150, 0, 255, 0.3);
    color: #9600ff;
}

.score {
    width: 120px;
    color: #00d4ff;
    font-weight: bold;
    text-align: right;
}

/* 响应式 */
@media (max-width: 900px) {
    .zones-container {
        flex-direction: column;
    }

    .mixed-zone-content {
        flex-direction: column;
    }

    .meta {
        flex-direction: column;
        gap: 5px;
    }

    .ranking-header,
    .ranking-row {
        padding: 10px 15px;
        font-size: 12px;
    }

    .ranking-header .col-zone,
    .zone-tag {
        width: 80px;
    }

    .ranking-header .col-score,
    .score {
        width: 100px;
    }
}
```

- [ ] **步骤 2：验证文件创建**

运行：`ls -la "C:\Users\28135\Desktop\huaxu国内版\css\style.css"`
预期：文件存在

- [ ] **步骤 3：Commit**

```bash
cd "C:\Users\28135\Desktop\huaxu国内版"
git add css/style.css
git commit -m "feat: 创建CSS样式文件"
```

---

### 任务 3：创建JavaScript主逻辑

**文件：**
- 创建：`C:\Users\28135\Desktop\huaxu国内版\js\main.js`

- [ ] **步骤 1：创建JS文件**

```javascript
// API配置
const API_URL = 'https://api.huaxu.app/servers/cn/warzone/current/16';

// 元素类型映射
const ELEMENT_MAP = {
    'physical': 'physical',
    'fire': 'fire',
    'thunder': 'thunder',
    'ice': 'physical'  // 默认使用physical样式
};

// 获取元素类型对应的CSS类
function getElementClass(element) {
    return ELEMENT_MAP[element] || 'physical';
}

// 格式化数字
function formatNumber(num) {
    return num.toLocaleString('zh-CN');
}

// 格式化时间
function formatTime(timeStr) {
    const date = new Date(timeStr);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// 创建战区卡片HTML
function createZoneCard(zone) {
    const elementClass = getElementClass(zone.element);

    let buffsHtml = '';
    if (zone.buffs && zone.buffs.length > 0) {
        buffsHtml = zone.buffs.map(buff => `
            <div class="zone-info">
                <div class="info-label">增益：${buff.name}</div>
                <div class="info-desc">${buff.description}</div>
            </div>
        `).join('');
    }

    let weathersHtml = '';
    if (zone.weathers && zone.weathers.length > 0) {
        weathersHtml = zone.weathers.map(weather => `
            <div class="zone-info">
                <div class="info-label">天气：${weather.name}</div>
                <div class="info-desc">${weather.description}</div>
            </div>
        `).join('');
    }

    return `
        <div class="zone-card ${elementClass}">
            <div class="zone-name">${zone.name}</div>
            <div class="zone-desc">${zone.description}</div>
            ${weathersHtml}
            ${buffsHtml}
        </div>
    `;
}

// 创建混合区卡片HTML
function createMixedZoneCard(zone) {
    let buffsHtml = '';
    if (zone.buffs && zone.buffs.length > 0) {
        buffsHtml = zone.buffs.map(buff => `
            <div class="zone-info">
                <div class="info-label">${buff.name}</div>
                <div class="info-desc">${buff.description}</div>
            </div>
        `).join('');
    }

    let weathersHtml = '';
    if (zone.weathers && zone.weathers.length > 0) {
        weathersHtml = zone.weathers.map(weather => `
            <div class="zone-info">
                <div class="info-label">天气：${weather.name}</div>
                <div class="info-desc">${weather.description}</div>
            </div>
        `).join('');
    }

    return `
        <div class="mixed-zone-card">
            <div class="zone-name">${zone.name}</div>
            <div class="zone-desc">${zone.description}</div>
            ${weathersHtml}
            ${buffsHtml}
        </div>
    `;
}

// 渲染战区卡片
function renderZones(zones) {
    const container = document.getElementById('zonesContainer');
    let html = '';

    zones.forEach(zone => {
        // 判断是否为混合区（包含多个增益）
        if (zone.buffs && zone.buffs.length > 2) {
            html += `
                <div class="mixed-zone">
                    <div class="mixed-zone-header">
                        ${zone.name} <span class="tag">混合区</span>
                    </div>
                    <div class="mixed-zone-content">
                        ${createMixedZoneCard(zone)}
                    </div>
                </div>
            `;
        } else {
            html += createZoneCard(zone);
        }
    });

    container.innerHTML = html;
}

// 获取战区名称的CSS类
function getZoneClass(zoneName) {
    if (zoneName.includes('火焰') || zoneName.includes('火')) return 'fire';
    if (zoneName.includes('机械') || zoneName.includes('物理')) return 'physical';
    if (zoneName.includes('镭射') || zoneName.includes('蚀刃') || zoneName.includes('熵钟')) return 'thunder';
    return 'physical';
}

// 渲染排行榜
function renderRankings(rankings) {
    const container = document.getElementById('rankingTable');

    let html = `
        <div class="ranking-header">
            <div class="col-rank">排名</div>
            <div class="col-player">玩家</div>
            <div class="col-zone">选择战区</div>
            <div class="col-score">分数</div>
        </div>
    `;

    rankings.slice(0, 100).forEach(ranking => {
        const rankClass = ranking.rank <= 3 ? `top-${ranking.rank}` : '';
        const zoneName = ranking.zones && ranking.zones[0] ?
            getZoneNameById(ranking.zones[0].id) : '--';
        const zoneClass = getZoneClass(zoneName);

        html += `
            <div class="ranking-row">
                <div class="rank-num ${rankClass}">${ranking.rank}</div>
                <div class="player-info">
                    <div class="player-name">${ranking.player.name}</div>
                    <div class="guild-name">${ranking.player.guildName || ''}</div>
                </div>
                <div class="zone-tag">
                    <span class="zone-badge ${zoneClass}">${zoneName}</span>
                </div>
                <div class="score">${formatNumber(ranking.score)}</div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// 根据ID获取战区名称（需要从zones数据中获取）
let zonesData = [];
function getZoneNameById(zoneId) {
    const zone = zonesData.find(z => z.id === zoneId);
    return zone ? zone.name : '--';
}

// 更新页面标题信息
function updateHeader(data) {
    document.getElementById('server').textContent = `服务器: ${data.server.toUpperCase()}`;
    document.getElementById('members').textContent = `参与人数: ${formatNumber(data.members)}`;
    document.getElementById('updatedAt').textContent = `更新时间: ${formatTime(data.updatedAt)}`;
}

// 加载数据
async function loadData() {
    try {
        const response = await fetch(API_URL);
        const result = await response.json();

        if (result.status === 'success' && result.data && result.data.warzone) {
            const warzone = result.data.warzone;

            // 保存zones数据
            zonesData = warzone.area.zones;

            // 更新标题
            updateHeader(warzone);

            // 渲染战区卡片
            renderZones(warzone.area.zones);

            // 渲染排行榜
            renderRankings(warzone.rankings);
        } else {
            console.error('API返回数据格式错误:', result);
        }
    } catch (error) {
        console.error('加载数据失败:', error);
    }
}

// 页面加载完成后获取数据
document.addEventListener('DOMContentLoaded', loadData);
```

- [ ] **步骤 2：验证文件创建**

运行：`ls -la "C:\Users\28135\Desktop\huaxu国内版\js\main.js"`
预期：文件存在

- [ ] **步骤 3：Commit**

```bash
cd "C:\Users\28135\Desktop\huaxu国内版"
git add js/main.js
git commit -m "feat: 创建JavaScript主逻辑"
```

---

### 任务 4：测试和验证

**文件：**
- 修改：无（仅测试）

- [ ] **步骤 1：启动本地服务器测试**

运行：`cd "C:\Users\28135\Desktop\huaxu国内版" && npx serve`
预期：服务器启动，显示本地URL

- [ ] **步骤 2：在浏览器中打开页面**

打开 http://localhost:3000 或显示的URL

- [ ] **步骤 3：验证页面功能**

检查以下内容：
- 页面标题显示服务器、参与人数、更新时间
- 战区卡片正确显示3个区
- 混合区（熵钟异数）显示为特殊样式
- 排行榜显示TOP 100玩家
- 排行榜显示玩家选择的战区

- [ ] **步骤 4：Commit最终版本**

```bash
cd "C:\Users\28135\Desktop\huaxu国内版"
git add .
git commit -m "feat: 完成战区数据展示网页"
```

---

## 自检清单

1. ✅ 规格覆盖度：所有需求都有对应任务
2. ✅ 占位符扫描：无TODO或待定内容
3. ✅ 类型一致性：函数名、变量名一致
4. ✅ 代码完整性：每个步骤都有完整代码
