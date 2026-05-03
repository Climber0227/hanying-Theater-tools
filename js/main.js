// API配置
const WARZONE_API_BASE = 'https://api.huaxu.app/servers/cn/warzone';
const PLAYER_API_BASE = 'https://api.huaxu.app/servers/cn/players';
const ASSETS_BASE = 'https://assets.huaxu.app/cn-beta';
let currentWeek = 568;
let currentDifficulty = '16';

// 获取图片URL
function getImageUrl(path) {
    if (!path) return '';
    return `${ASSETS_BASE}/${path}.png`;
}

// 模拟浏览器请求头
const REQUEST_HEADERS = {
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
};

// 带请求头的fetch封装
async function fetchWithHeaders(url) {
    const response = await fetch(url, {
        method: 'GET',
        headers: REQUEST_HEADERS,
        mode: 'cors',
        credentials: 'omit'
    });
    return response;
}

// 计算日期范围（战区每周一刷新）
function getWeekDateRange(week) {
    // 基准日期：第1周的开始日期（需要根据实际情况调整）
    // 这里假设第1周从某个固定日期开始
    // 由于不知道确切的起始周，我们用当前周数反推
    const now = new Date();
    const currentWeekStart = new Date(now);
    // 调整到本周一
    const dayOfWeek = currentWeekStart.getDay();
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    currentWeekStart.setDate(currentWeekStart.getDate() - diff);

    // 计算目标周的开始日期
    const weekDiff = 568 - week;
    const targetStart = new Date(currentWeekStart);
    targetStart.setDate(targetStart.getDate() - (weekDiff * 7));

    const targetEnd = new Date(targetStart);
    targetEnd.setDate(targetEnd.getDate() + 6);

    const formatDate = (date) => {
        return `${date.getFullYear()}年${String(date.getMonth() + 1).padStart(2, '0')}月${String(date.getDate()).padStart(2, '0')}日`;
    };

    return `${formatDate(targetStart)} - ${formatDate(targetEnd)}`;
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
        <div class="zone-card">
            <div class="zone-name">${zone.name}</div>
            <div class="zone-desc">${zone.description}</div>
            ${weathersHtml}
            ${buffsHtml}
        </div>
    `;
}

// 创建混合区子卡片HTML
function createMixedSubCard(zone, buff, weather) {
    return `
        <div class="mixed-sub-card">
            <div class="mixed-sub-header">${zone.name}</div>
            <div class="zone-name">${buff.name}</div>
            <div class="zone-desc">${zone.description}</div>
            <div class="zone-info">
                <div class="info-label">天气：${weather.name}</div>
                <div class="info-desc">${weather.description}</div>
            </div>
            <div class="zone-info">
                <div class="info-label">增益：${buff.name}</div>
                <div class="info-desc">${buff.description}</div>
            </div>
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
            // 为每个增益创建独立的子卡片
            let subCardsHtml = '';
            zone.buffs.forEach((buff, index) => {
                // 交换天气索引：第一个buff对应第二个weather，第二个buff对应第一个weather
                const weatherIndex = zone.weathers && zone.weathers.length >= 2 ? 1 - index : 0;
                const weather = zone.weathers && zone.weathers[weatherIndex] ? zone.weathers[weatherIndex] : zone.weathers[0];
                subCardsHtml += createMixedSubCard(zone, buff, weather);
            });

            html += `
                <div class="mixed-zone">
                    <div class="mixed-zone-header">
                        ${zone.name} <span class="tag">混合区</span>
                    </div>
                    <div class="mixed-zone-content">
                        ${subCardsHtml}
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
        headerHtml += `<div class="col-zone-score">${zone.name}</div>`;
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
            html += `<div class="zone-score">${score}</div>`;
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
    document.getElementById('members').textContent = `参与人数: ${formatNumber(data.members)}`;
    document.getElementById('updatedAt').textContent = `更新时间: ${formatTime(data.updatedAt)}`;
    document.getElementById('weekDisplay').textContent = `第${data.activity}周`;
    document.getElementById('dateRange').textContent = getWeekDateRange(data.activity);
}

// 加载战区数据
async function loadWarzoneData() {
    try {
        const url = `${WARZONE_API_BASE}/${currentWeek}/${currentDifficulty}`;
        const response = await fetchWithHeaders(url);
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

// 加载玩家数据
async function loadPlayerData(playerId) {
    try {
        const url = `${PLAYER_API_BASE}/${playerId}`;
        const response = await fetchWithHeaders(url);
        const result = await response.json();

        if (result.status === 'success' && result.data && result.data.player) {
            const player = result.data.player;
            const characters = result.data.characters || [];

            // 更新玩家信息
            updatePlayerInfo(player, characters);
        } else {
            console.error('API返回数据格式错误:', result);
            alert('未找到该玩家');
        }
    } catch (error) {
        console.error('加载玩家数据失败:', error);
        alert('查询失败，请检查玩家ID');
    }
}

// 更新玩家信息
function updatePlayerInfo(player, characters) {
    const playerInfo = document.getElementById('playerInfo');
    playerInfo.style.display = 'block';

    // 基本信息
    document.getElementById('playerName').textContent = player.name;
    document.getElementById('playerLevel').textContent = player.level;
    document.getElementById('playerSign').textContent = player.sign || '暂无签名';
    document.getElementById('playerGuild').textContent = player.guildName || '暂无公会';
    document.getElementById('playerLikes').textContent = player.likes || 0;

    // 头像和头像框
    const portrait = document.getElementById('playerPortrait');
    const frame = document.getElementById('playerFrame');
    if (player.portrait) {
        portrait.src = getImageUrl(player.portrait);
    }
    if (player.frame) {
        frame.src = getImageUrl(player.frame);
    }

    // 角色列表
    const charCount = document.getElementById('charCount');
    const charactersGrid = document.getElementById('charactersGrid');

    // 只显示已获得的角色
    const acquiredChars = characters.filter(c => c.acquired);
    charCount.textContent = `(${acquiredChars.length})`;

    let html = '';
    acquiredChars.forEach(char => {
        const iconUrl = char.fashionIcon ? getImageUrl(char.fashionIcon) : '';
        const levelText = char.level > 0 ? `Lv.${char.level}` : '';
        const qualityText = char.quality > 0 ? `★${char.quality}` : '';
        const frameTypeText = char.frameType === 'omniframe' ? 'S' : 'A';

        html += `
            <div class="character-card">
                <div class="character-icon">
                    <img src="${iconUrl}" alt="${char.characterName}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22><rect fill=%22%23333%22 width=%2264%22 height=%2264%22/></svg>'">
                </div>
                <div class="character-info">
                    <div class="character-name">${char.characterName}</div>
                    <div class="character-frame">${char.frameName}</div>
                    <div class="character-stats">
                        ${levelText ? `<span>${levelText}</span>` : ''}
                        ${qualityText ? `<span>${qualityText}</span>` : ''}
                        <span>${frameTypeText}</span>
                    </div>
                </div>
            </div>
        `;
    });

    charactersGrid.innerHTML = html;
}

// 初始化导航和选择器
function initNavigation() {
    // 页面导航
    const navBtns = document.querySelectorAll('.nav-btn');
    const pages = document.querySelectorAll('.page');

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetPage = btn.dataset.page;

            navBtns.forEach(b => b.classList.remove('active'));
            pages.forEach(p => p.classList.remove('active'));

            btn.classList.add('active');
            document.getElementById(`${targetPage}Page`).classList.add('active');
        });
    });

    // 战区选择器
    const difficultySelect = document.getElementById('difficultySelect');
    const prevWeekBtn = document.getElementById('prevWeek');
    const nextWeekBtn = document.getElementById('nextWeek');

    difficultySelect.value = currentDifficulty;

    difficultySelect.addEventListener('change', (e) => {
        currentDifficulty = e.target.value;
        loadWarzoneData();
    });

    prevWeekBtn.addEventListener('click', () => {
        currentWeek--;
        loadWarzoneData();
    });

    nextWeekBtn.addEventListener('click', () => {
        if (currentWeek < 568) {
            currentWeek++;
            loadWarzoneData();
        }
    });

    // 玩家查询
    const searchBtn = document.getElementById('searchBtn');
    const playerIdInput = document.getElementById('playerIdInput');

    searchBtn.addEventListener('click', () => {
        const playerId = playerIdInput.value.trim();
        if (playerId) {
            loadPlayerData(playerId);
        }
    });

    playerIdInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const playerId = playerIdInput.value.trim();
            if (playerId) {
                loadPlayerData(playerId);
            }
        }
    });
}

// 页面加载完成后获取数据
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    loadWarzoneData();
});
