// API配置
const API_URL = 'https://api.huaxu.app/servers/cn/warzone/current/16';

// 元素类型映射
const ELEMENT_MAP = {
    'physical': 'physical',
    'fire': 'fire',
    'thunder': 'thunder',
    'ice': 'physical'  // 默认使用physical样式
};

// 根据战区名称获取元素类型CSS类
function getElementClassByName(zoneName) {
    if (zoneName.includes('火焰') || zoneName.includes('火')) return 'fire';
    if (zoneName.includes('机械') || zoneName.includes('物理')) return 'physical';
    if (zoneName.includes('镭射') || zoneName.includes('蚀刃') || zoneName.includes('熵钟')) return 'thunder';
    return 'physical';
}

// 获取元素类型对应的CSS类（优先从名称判断）
function getElementClass(element, zoneName) {
    if (zoneName) return getElementClassByName(zoneName);
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
    const elementClass = getElementClass(zone.element, zone.name);

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
        if (zone.buffs && zone.buffs.length >= 2) {
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

// 渲染排行榜
function renderRankings(rankings, zones) {
    const container = document.getElementById('rankingTable');

    // 动态生成表头，显示每个战区名称
    let headerHtml = `
        <div class="ranking-header">
            <div class="col-rank">排名</div>
            <div class="col-player">玩家</div>
    `;
    zones.forEach(zone => {
        const zoneClass = getElementClassByName(zone.name);
        headerHtml += `<div class="col-zone-score ${zoneClass}">${zone.name}</div>`;
    });
    headerHtml += `
            <div class="col-total">总分</div>
        </div>
    `;

    let html = headerHtml;

    rankings.slice(0, 100).forEach(ranking => {
        const rankClass = ranking.rank <= 3 ? `top-${ranking.rank}` : '';

        html += `
            <div class="ranking-row">
                <div class="rank-num ${rankClass}">${ranking.rank}</div>
                <div class="player-info">
                    <div class="player-name">${ranking.player.name}</div>
                    <div class="guild-name">${ranking.player.guildName || ''}</div>
                </div>
        `;

        // 显示每个战区的分数
        zones.forEach(zone => {
            const zoneData = ranking.zones ? ranking.zones.find(z => z.id === zone.id) : null;
            const score = zoneData ? formatNumber(zoneData.score) : '--';
            const zoneClass = getElementClassByName(zone.name);
            html += `<div class="zone-score ${zoneClass}">${score}</div>`;
        });

        html += `
                <div class="total-score">${formatNumber(ranking.score)}</div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// 保存zones数据
let zonesData = [];

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
            const rankings = result.data.rankings;

            // 保存zones数据
            zonesData = warzone.area.zones;

            // 更新标题
            updateHeader(warzone);

            // 渲染战区卡片
            renderZones(warzone.area.zones);

            // 渲染排行榜
            if (rankings) {
                renderRankings(rankings, zonesData);
            }
        } else {
            console.error('API返回数据格式错误:', result);
        }
    } catch (error) {
        console.error('加载数据失败:', error);
    }
}

// 页面加载完成后获取数据
document.addEventListener('DOMContentLoaded', loadData);
