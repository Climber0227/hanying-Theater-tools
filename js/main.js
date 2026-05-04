// 使用config.js中定义的配置
let currentWeek = null;
let maxWeek = null;
let minWeek = null;
let currentDifficulty = localStorage.getItem('currentDifficulty') || '16';
let currentPpcWeek = null;
let maxPpcWeek = null;
let minPpcWeek = null;
let currentPpcLevel = localStorage.getItem('currentPpcLevel') || '4';
const HISTORY_KEY = 'player_search_history';
const MAX_HISTORY = 20;
const BIND_KEY = 'player_bind';
const FOLLOW_KEY = 'player_follows';
const MAX_FOLLOWS = 20;
const WZ_SCORE_KEY = 'my_wz_scores';
const PPC_SCORE_KEY = 'my_ppc_scores';

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

// 格式化日期范围
function formatDateRange(start, end) {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const formatDate = (date) => {
        return `${date.getFullYear()}年${String(date.getMonth() + 1).padStart(2, '0')}月${String(date.getDate()).padStart(2, '0')}日`;
    };
    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
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

// 角色阶级映射
const QUALITY_MAP = {
    1: 'B',
    2: 'A',
    3: 'S',
    4: 'SS',
    5: 'SSS',
    6: 'SSS+'
};

function getQualityInfo(quality) {
    return QUALITY_MAP[quality] || '';
}

// 获取怪物数量标签
function getMonsterTag(desc) {
    if (!desc) return '';
    if (desc.includes('祸不单行')) return '双怪';
    if (desc.includes('斗众之势')) return '群怪';
    if (desc.includes('困兽犹斗')) return '单怪';
    return '';
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

    const monsterTag = getMonsterTag(zone.description);

    return `
        <div class="zone-card">
            <div class="zone-name">${zone.name}${monsterTag ? ` <span class="zone-tag">${monsterTag}</span>` : ''}</div>
            <div class="zone-desc">${zone.description}</div>
            ${weathersHtml}
            ${buffsHtml}
        </div>
    `;
}

// 创建混合区子卡片HTML
function createMixedSubCard(zone, buff, weather) {
    const monsterTag = getMonsterTag(zone.description);
    return `
        <div class="mixed-sub-card">
            <div class="mixed-sub-header">${zone.name}${monsterTag ? ` <span class="zone-tag">${monsterTag}</span>` : ''}</div>
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

            // 生成子区名称和怪物数量标签
            const monsterTag = getMonsterTag(zone.description);
            const subZoneLabels = zone.buffs.map(buff => {
                return buff.name + (monsterTag ? ` ${monsterTag}` : '');
            }).join(' / ');

            html += `
                <div class="mixed-zone">
                    <div class="mixed-zone-header">
                        ${zone.name} <span class="sub-zone-labels">${subZoneLabels}</span>
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
function getZoneScore(ranking, zoneIndex) {
    if (!ranking.zones || !ranking.zones[zoneIndex]) return 0;
    return ranking.zones[zoneIndex].score;
}

function sortRankings(rankings, zones) {
    if (wzSortKey === null) return rankings;
    const sorted = [...rankings];
    sorted.sort((a, b) => {
        let va, vb;
        if (wzSortKey === 'total') {
            va = a.score; vb = b.score;
        } else {
            const idx = parseInt(wzSortKey);
            va = getZoneScore(a, idx);
            vb = getZoneScore(b, idx);
        }
        return wzSortAsc ? va - vb : vb - va;
    });
    return sorted;
}

function renderRankings(rankings, zones) {
    const container = document.getElementById('rankingTable');
    const sorted = sortRankings(rankings, zones).slice(0, 100);

    // 排序指示器
    const arrow = (key) => {
        if (wzSortKey === key) return wzSortAsc ? ' ▲' : ' ▼';
        return ' ⇅';
    };

    // 动态生成表头（可点击排序）
    let headerHtml = `
        <div class="ranking-header">
            <div class="col-rank">排名</div>
            <div class="col-player">玩家</div>
    `;
    zones.forEach((zone, i) => {
        headerHtml += `<div class="col-zone-detail sortable" data-sort="${i}">${zone.name}<span class="sort-arrow">${arrow(String(i))}</span></div>`;
    });
    headerHtml += `
            <div class="col-total sortable" data-sort="total">总分<span class="sort-arrow">${arrow('total')}</span></div>
        </div>
    `;

    let html = headerHtml;

    const total = sorted.length;
    sorted.forEach((ranking, idx) => {
        const displayRank = wzSortAsc ? total - idx : idx + 1;
        const rankClass = displayRank <= 3 ? `top-${displayRank}` : '';
        const portraitUrl = ranking.player.portrait ? getImageUrl(ranking.player.portrait) : '';
        const frameUrl = ranking.player.frame ? getImageUrl(ranking.player.frame) : '';

        html += `
            <div class="ranking-row">
                <div class="rank-num ${rankClass}">${displayRank}</div>
                <div class="player-info ranking-player" data-player-id="${ranking.player.id}">
                    <div class="player-avatar-sm">
                        <img src="${portraitUrl}" alt="" onerror="this.style.display='none'">
                        <img src="${frameUrl}" alt="" class="frame-sm" onerror="this.style.display='none'">
                    </div>
                    <div class="player-text">
                        <div class="player-name">${ranking.player.name}</div>
                        <div class="player-id-text">ID: ${ranking.player.id}</div>
                        <div class="guild-name">${ranking.player.guildName || ''}</div>
                        ${ranking.player.sign ? `<div class="player-sign">${ranking.player.sign}</div>` : ''}
                    </div>
                </div>
        `;

        zones.forEach(zone => {
            const zoneData = ranking.zones ? ranking.zones.find(z => z.id === zone.id) : null;
            const score = zoneData ? formatNumber(zoneData.score) : '--';
            let charsHtml = '';
            if (zoneData && zoneData.characters) {
                zoneData.characters.forEach(c => {
                    const charIcon = c.icon ? getImageUrl(c.icon) : '';
                    const cubIcon = c.cubIcon ? getImageUrl(c.cubIcon) : '';
                    charsHtml += `
                        <div class="char-row">
                            <img class="char-icon-sm" src="${charIcon}" alt="" onerror="this.style.display='none'">
                            <span class="char-name-sm">${c.characterName}</span>
                            <span class="char-bp">${c.bp}</span>
                            <img class="cub-icon-sm" src="${cubIcon}" alt="" title="${c.cubName || ''}" onerror="this.style.display='none'">
                        </div>
                    `;
                });
            }
            html += `
                <div class="zone-detail">
                    <div class="zone-score-val">${score}</div>
                    <div class="zone-chars">${charsHtml}</div>
                </div>
            `;
        });

        html += `
                <div class="total-score">${formatNumber(ranking.score)}</div>
            </div>
        `;
    });

    container.innerHTML = html;

    // 绑定排序点击事件
    container.querySelectorAll('.sortable').forEach(el => {
        el.addEventListener('click', () => {
            const key = el.dataset.sort;
            if (wzSortKey === key) {
                wzSortAsc = !wzSortAsc;
            } else {
                wzSortKey = key;
                wzSortAsc = false;
            }
            renderRankings(rawRankings, zonesData);
        });
    });

    // 绑定玩家点击事件
    container.querySelectorAll('.ranking-player').forEach(el => {
        el.addEventListener('click', () => {
            const playerId = el.dataset.playerId;
            if (playerId) {
                switchPage('player');
                loadPlayerData(playerId);
            }
        });
    });
}

// 保存zones数据
let zonesData = [];
// 保存原始排行榜数据（用于排序）
let rawRankings = [];
let rawPpcRankings = [];
// 排序状态
let wzSortKey = null;
let wzSortAsc = false;
let ppcSortAsc = false;

// 保存PPC boss数据
let ppcBossesData = [];
// 保存当前战区信息（用于我的页面）
let currentWarzoneInfo = null;
// 保存当前PPC信息（用于我的页面）
let currentPpcInfo = null;
// 我的页面-战区周数
let myWzWeek = null;
// 我的页面-PPC周数
let myPpcWeek = null;
// 保存当前查询的玩家ID
let currentPlayerId = null;

// 更新页面标题信息
function updateHeader(data) {
    document.getElementById('members').textContent = `参与人数: ${formatNumber(data.members)}`;
    document.getElementById('updatedAt').textContent = `更新时间: ${formatTime(data.updatedAt)}`;
    document.getElementById('dateRange').textContent = formatDateRange(data.start, data.end);
}

// 计算某周的日期区间（基于第569周起始日期推算）
const REFERENCE_WEEK = 569;
const REFERENCE_START = new Date('2026-05-03T21:00:00Z'); // 第569周周一UTC+8
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function getWeekDateRange(weekNum) {
    const start = new Date(REFERENCE_START.getTime() + (weekNum - REFERENCE_WEEK) * WEEK_MS);
    const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
    const fmt = (d) => `${d.getUTCFullYear()}年${String(d.getUTCMonth() + 1).padStart(2, '0')}月${String(d.getUTCDate()).padStart(2, '0')}日`;
    return `${fmt(start)} - ${fmt(end)}`;
}

// 填充周数下拉框（从大到小，含日期区间）
function populateWeekSelect(selectId, minWeek, maxWeek, selectedWeek) {
    const select = document.getElementById(selectId);
    if (!select) return;
    let html = '';
    for (let w = maxWeek; w >= minWeek; w--) {
        const sel = w === selectedWeek ? ' selected' : '';
        const range = getWeekDateRange(w);
        html += `<option value="${w}"${sel}>第${w}周 ${range}</option>`;
    }
    select.innerHTML = html;
}

// 加载战区数据
async function loadWarzoneData() {
    try {
        const weekPath = currentWeek || 'current';
        const url = `${API_CONFIG.warzone}/${weekPath}/${currentDifficulty}`;
        const response = await fetchWithHeaders(url);
        const result = await response.json();

        if (result.status === 'success' && result.data && result.data.warzone) {
            const warzone = result.data.warzone;
            const rankings = result.data.rankings;

            // 记录周数范围
            if (result.data.activities) {
                minWeek = result.data.activities.min;
                maxWeek = result.data.activities.max;
            }
            if (currentWeek === null) {
                currentWeek = warzone.activity;
            }

            // 填充周数下拉框
            populateWeekSelect('weekSelect', minWeek, maxWeek, warzone.activity);
            populateWeekSelect('myWzWeekSelect', minWeek, maxWeek, warzone.activity);

            // 保存zones数据
            zonesData = warzone.area.zones;

            // 保存当前战区信息
            currentWarzoneInfo = {
                week: warzone.activity,
                zones: warzone.area.zones.map(z => ({ name: z.name, desc: z.description, buffs: z.buffs }))
            };

            // 更新标题
            updateHeader(warzone);

            // 渲染战区卡片
            renderZones(warzone.area.zones);

            // 渲染排行榜
            if (rankings) {
                rawRankings = rankings;
                wzSortKey = null;
                wzSortAsc = false;
                renderRankings(rankings, zonesData);
            }

            // 同步难度选择器
            document.getElementById('difficultySelect').value = currentDifficulty;

            // 更新区名下拉框
            populateZoneNameSelect();
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
        const url = `${API_CONFIG.player}/${playerId}`;
        const response = await fetchWithHeaders(url);
        const result = await response.json();

        if (result.status === 'success' && result.data && result.data.player) {
            const player = result.data.player;
            const characters = result.data.characters || [];

            // 保存玩家ID
            currentPlayerId = playerId;

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

// 历史查询功能
function getSearchHistory() {
    const history = localStorage.getItem(HISTORY_KEY);
    return history ? JSON.parse(history) : [];
}

function saveToHistory(playerId, playerName, portrait) {
    let history = getSearchHistory();

    // 移除重复记录
    history = history.filter(item => item.id !== playerId);

    // 添加到开头
    history.unshift({
        id: playerId,
        name: playerName,
        portrait: portrait,
        timestamp: Date.now()
    });

    // 限制历史记录数量
    if (history.length > MAX_HISTORY) {
        history = history.slice(0, MAX_HISTORY);
    }

    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    renderHistory();
    AUTH.syncToCloud('history', history);
}

function clearHistory() {
    localStorage.removeItem(HISTORY_KEY);
    renderHistory();
    AUTH.deleteFromCloud('history');
}

function renderHistory() {
    const historyList = document.getElementById('historyList');
    const history = getSearchHistory();

    if (history.length === 0) {
        historyList.innerHTML = '<div class="history-empty">暂无查询记录</div>';
        return;
    }

    let html = '';
    history.forEach(item => {
        const portraitUrl = item.portrait ? getImageUrl(item.portrait) : '';
        html += `
            <div class="history-item" data-id="${item.id}">
                <img class="history-avatar" src="${portraitUrl}" alt="${item.name}"
                     onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 36 36%22><rect fill=%22%23333%22 width=%2236%22 height=%2236%22/></svg>'">
                <div class="history-info">
                    <div class="history-name">${item.name}</div>
                    <div class="history-id">ID: ${item.id}</div>
                </div>
            </div>
        `;
    });

    historyList.innerHTML = html;

    // 添加点击事件
    document.querySelectorAll('.history-item').forEach(item => {
        item.addEventListener('click', () => {
            const playerId = item.dataset.id;
            loadPlayerData(playerId);
        });
    });
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

    // 保存到历史
    saveToHistory(player.id, player.name, player.portrait);

    // 绑定和关注按钮
    document.getElementById('bindSetBtn').onclick = () => {
        bindPlayer(player);
        alert('已绑定为我的角色');
    };
    document.getElementById('followSetBtn').onclick = () => {
        addFollow(player.id, player.name, player.portrait);
        alert('已关注');
    };

    // 角色列表
    const charCount = document.getElementById('charCount');
    const charactersGrid = document.getElementById('charactersGrid');

    // 只显示已获得的角色
    const acquiredChars = characters.filter(c => c.acquired);
    charCount.textContent = `(${acquiredChars.length})`;

    let html = '';
    acquiredChars.forEach(char => {
        const iconUrl = char.fashionIcon ? getImageUrl(char.fashionIcon) : '';
        const isHidden = char.level === 0;
        const levelText = char.level > 0 ? `Lv.${char.level}` : '';
        const qualityInfo = getQualityInfo(char.quality);

        html += `
            <div class="character-card${isHidden ? ' character-hidden' : ''}" data-char-id="${char.id}" style="cursor:pointer;">
                <div class="character-icon">
                    <img src="${iconUrl}" alt="${char.characterName}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22><rect fill=%22%23333%22 width=%2264%22 height=%2264%22/></svg>'">
                </div>
                <div class="character-info">
                    <div class="character-name">${char.characterName}<span class="character-frame">${char.frameName}</span>${isHidden ? ' <span class="hidden-tag">隐藏</span>' : ''}</div>
                    ${isHidden ? '' : `<div class="character-stats">
                        ${levelText ? `<span>${levelText}</span>` : ''}
                        ${qualityInfo ? `<span class="quality-tag quality-${char.quality}">${qualityInfo}</span>` : ''}
                    </div>`}
                </div>
            </div>
        `;
    });

    charactersGrid.innerHTML = html;

    // 添加点击事件
    document.querySelectorAll('.character-card').forEach(card => {
        card.addEventListener('click', () => {
            const charId = card.dataset.charId;
            loadCharacterDetail(charId);
        });
    });
}

// 渲染PPC页面
function renderPpc(ppc) {
    // 更新头部信息
    document.getElementById('ppcDateRange').textContent = formatDateRange(ppc.start, ppc.end);
    document.getElementById('ppcLevel').textContent = `分区: ${ppc.level.name}`;
    document.getElementById('ppcUpdatedAt').textContent = ppc.updatedAt ? `更新时间: ${formatTime(ppc.updatedAt)}` : '';

    // 保存boss数据
    ppcBossesData = ppc.bosses;

    // 渲染Boss列表
    const container = document.getElementById('ppcBossesContainer');
    let html = '';

    ppc.bosses.forEach((boss, index) => {
        const bossIconUrl = boss.icon ? getImageUrl(boss.icon) : '';

        html += `
            <div class="ppc-boss-card" data-index="${index}">
                <img class="ppc-boss-icon" src="${bossIconUrl}" alt="${boss.name}"
                     onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 80 80%22><rect fill=%22%23333%22 width=%2280%22 height=%2280%22/></svg>'">
                <div class="ppc-boss-name">${boss.name}</div>
            </div>
        `;
    });

    container.innerHTML = html;

    // 添加点击事件
    document.querySelectorAll('.ppc-boss-card').forEach(card => {
        card.addEventListener('click', () => {
            const index = parseInt(card.dataset.index);
            showBossDetail(ppcBossesData[index]);
        });
    });
}

// 显示Boss详情弹窗
function showBossDetail(boss) {
    const modal = document.getElementById('bossModal');
    const detail = document.getElementById('bossDetail');
    const bossIconUrl = boss.icon ? getImageUrl(boss.icon) : '';

    let stagesHtml = '';
    boss.stages.forEach(stage => {
        let buffsHtml = '';
        if (stage.buffs && stage.buffs.length > 0) {
            buffsHtml = stage.buffs.map(buff => `
                <div class="boss-buff">
                    <div class="boss-buff-name">${buff.name}</div>
                    <div class="boss-buff-desc">${buff.description}</div>
                </div>
            `).join('');
        }

        let skillsHtml = '';
        if (stage.skills && stage.skills.length > 0) {
            skillsHtml = stage.skills.map(skill => `
                <div class="boss-skill">
                    <span class="boss-skill-name">${skill.name}</span>
                    <span class="boss-skill-desc">${skill.description}</span>
                </div>
            `).join('');
        }

        stagesHtml += `
            <div class="boss-stage">
                <div class="boss-stage-header">
                    <span class="boss-stage-difficulty">${stage.difficulty}</span>
                    <span class="boss-stage-score">${formatNumber(stage.score)}分</span>
                </div>
                ${buffsHtml ? `
                <div class="boss-stage-section">
                    <div class="boss-section-title">增益</div>
                    ${buffsHtml}
                </div>
                ` : ''}
                ${skillsHtml ? `
                <div class="boss-stage-section">
                    <div class="boss-section-title">技能</div>
                    <div class="boss-skills">
                        ${skillsHtml}
                    </div>
                </div>
                ` : ''}
            </div>
        `;
    });

    detail.innerHTML = `
        <div class="boss-detail-header">
            <img class="boss-detail-icon" src="${bossIconUrl}" alt="${boss.name}"
                 onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 120 120%22><rect fill=%22%23333%22 width=%22120%22 height=%22120%22/></svg>'">
            <div class="boss-detail-info">
                <div class="boss-detail-name">${boss.name}</div>
                <div class="boss-detail-desc">${boss.description}</div>
            </div>
        </div>
        <div class="boss-stages">
            ${stagesHtml}
        </div>
    `;

    modal.style.display = 'flex';
}

// 关闭弹窗
function initModal() {
    // Boss弹窗
    const bossModal = document.getElementById('bossModal');
    document.getElementById('modalClose').addEventListener('click', () => {
        bossModal.style.display = 'none';
    });
    bossModal.addEventListener('click', (e) => {
        if (e.target === bossModal) bossModal.style.display = 'none';
    });

    // 角色弹窗
    const charModal = document.getElementById('charModal');
    document.getElementById('charModalClose').addEventListener('click', () => {
        charModal.style.display = 'none';
    });
    charModal.addEventListener('click', (e) => {
        if (e.target === charModal) charModal.style.display = 'none';
    });
}

// 加载角色详情
async function loadCharacterDetail(charId) {
    const modal = document.getElementById('charModal');
    const detail = document.getElementById('charDetail');
    detail.innerHTML = '<div class="char-loading">加载中...</div>';
    modal.style.display = 'flex';

    try {
        const url = `${API_CONFIG.player}/${currentPlayerId}/characters/${charId}`;
        const response = await fetchWithHeaders(url);
        const result = await response.json();

        if (result.status === 'success' && result.data && result.data.character) {
            renderCharacterDetail(result.data);
        } else {
            detail.innerHTML = '<div class="char-loading">加载失败</div>';
        }
    } catch (error) {
        console.error('加载角色详情失败:', error);
        detail.innerHTML = '<div class="char-loading">加载失败</div>';
    }
}

// 渲染角色详情
function renderCharacterDetail(data) {
    const detail = document.getElementById('charDetail');
    const char = data.character;
    const fashion = data.fashion;
    const skills = data.skills || [];
    const leapSkills = data.leapSkills || [];
    const memories = data.memories || [];
    const suits = data.suits || [];
    const weapon = data.weapon;
    const cub = data.cub;

    const iconUrl = fashion && fashion.iconHead ? getImageUrl(fashion.iconHead) : '';
    const classIconUrl = char.classIcon ? getImageUrl(char.classIcon) : '';
    const elementStr = char.elements ? char.elements.map(e => e.element).join('/') : '';

    // 头部信息
    let html = `
        <div class="char-header">
            <div class="char-icon-wrap">
                <img src="${iconUrl}" alt="${char.characterName}"
                     onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 80 80%22><rect fill=%22%23333%22 width=%2280%22 height=%2280%22/></svg>'">
            </div>
            <div class="char-basic">
                <div class="char-name-row">
                    <span class="char-detail-name">${char.characterName}</span>
                    <span class="char-frame-name">${char.frameName}</span>
                </div>
                <div class="char-tags">
                    <span class="char-tag">${char.class || ''}</span>
                    <span class="char-tag">${elementStr}</span>
                    <span class="char-tag">${char.frameType === 'omniframe' ? 'S级' : 'A级'}</span>
                    <span class="char-tag">${char.gradeName || ''}</span>
                </div>
                <div class="char-stats">
                    Lv.<span>${char.level}</span>
                    ★<span>${char.quality}</span>
                    战力<span>${Math.floor(char.bp || 0)}</span>
                    好感<span>${char.trustLevel || 0}</span>
                    觉醒<span>${char.awakeningLevel || 0}</span>
                </div>
            </div>
        </div>
    `;

    // Tab导航
    html += `
        <div class="char-tabs">
            <button class="char-tab active" data-tab="skills">技能</button>
            <button class="char-tab" data-tab="memories">意识</button>
            <button class="char-tab" data-tab="weapon">武器</button>
            <button class="char-tab" data-tab="cub">辅助机</button>
        </div>
    `;

    // 技能Tab
    let skillsHtml = '<div class="skill-list">';
    skills.forEach(skill => {
        const skillIconUrl = skill.icon ? getImageUrl(skill.icon) : '';
        let descsHtml = '';
        if (skill.descriptions) {
            skill.descriptions.forEach(desc => {
                const cleanDesc = (desc.description || '').replace(/<color=[^>]*>/g, '').replace(/<\/color>/g, '');
                descsHtml += desc.title ? `<div class="skill-desc-title">${desc.title.replace(/<[^>]*>/g, '')}</div>` : '';
                descsHtml += `<div class="skill-desc-text">${cleanDesc}</div>`;
            });
        }
        const levelText = skill.level ? `Lv.${skill.level.total || skill.level.base}` : '';
        skillsHtml += `
            <div class="skill-item">
                <div class="skill-header">
                    <img class="skill-icon" src="${skillIconUrl}" alt="${skill.name}"
                         onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 36 36%22><rect fill=%22%23333%22 width=%2236%22 height=%2236%22/></svg>'">
                    <span class="skill-name">${skill.name}</span>
                    <span class="skill-level">${levelText}</span>
                </div>
                ${descsHtml}
            </div>
        `;
    });
    // 跃升技能
    leapSkills.forEach(skill => {
        const skillIconUrl = skill.icon ? getImageUrl(skill.icon) : '';
        let descsHtml = '';
        if (skill.descriptions) {
            skill.descriptions.forEach(desc => {
                const cleanDesc = (desc.description || '').replace(/<color=[^>]*>/g, '').replace(/<\/color>/g, '');
                descsHtml += `<div class="skill-desc-text">${cleanDesc}</div>`;
            });
        }
        skillsHtml += `
            <div class="skill-item">
                <div class="skill-header">
                    <img class="skill-icon" src="${skillIconUrl}" alt="${skill.name}"
                         onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 36 36%22><rect fill=%22%23333%22 width=%2236%22 height=%2236%22/></svg>'">
                    <span class="skill-name">${skill.name}</span>
                    <span class="skill-level">跃升 Lv.${skill.level.total}</span>
                </div>
                ${descsHtml}
            </div>
        `;
    });
    skillsHtml += '</div>';

    // 意识Tab
    let memoriesHtml = '<div class="memory-grid">';
    memories.forEach(mem => {
        const memIconUrl = mem.icon ? getImageUrl(mem.icon) : '';
        let resHtml = '';
        if (mem.resonances) {
            resHtml = mem.resonances.map(r => `${r.name}${r.hypertuned ? ' (超频)' : ''}`).join(' / ');
        }
        memoriesHtml += `
            <div class="memory-item">
                <img class="memory-icon" src="${memIconUrl}" alt="${mem.name}"
                     onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 48 48%22><rect fill=%22%23333%22 width=%2248%22 height=%2248%22/></svg>'">
                <div class="memory-info">
                    <div class="memory-name">${mem.name}</div>
                    <div class="memory-level">Lv.${mem.level} 突破${mem.breakthrough}</div>
                    <div class="memory-resonance">${resHtml}</div>
                </div>
            </div>
        `;
    });
    memoriesHtml += '</div>';

    // 套装效果
    if (suits.length > 0) {
        memoriesHtml += '<div style="margin-top:16px;">';
        suits.forEach(suit => {
            const suitIconUrl = suit.icon ? getImageUrl(suit.icon) : '';
            memoriesHtml += `
                <div class="memory-item" style="margin-bottom:8px;">
                    <img class="memory-icon" src="${suitIconUrl}" alt="${suit.name}"
                         onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 48 48%22><rect fill=%22%23333%22 width=%2248%22 height=%2248%22/></svg>'">
                    <div class="memory-info">
                        <div class="memory-name">${suit.name} (${suit.level}件套)</div>
                        ${suit.skills ? suit.skills.map(s => `<div class="memory-resonance">${s.level}件: ${s.description} ${s.active ? '✓' : ''}</div>`).join('') : ''}
                    </div>
                </div>
            `;
        });
        memoriesHtml += '</div>';
    }

    // 武器Tab
    let weaponHtml = '';
    if (weapon) {
        const weaponIconUrl = weapon.icon ? getImageUrl(weapon.icon) : '';
        let weaponResHtml = '';
        if (weapon.resonances) {
            weaponResHtml = weapon.resonances.map(r => `<div class="weapon-skill-name">${r.name}: <span style="color:#666">${r.description}</span></div>`).join('');
        }
        let weaponSkillHtml = '';
        if (weapon.weaponSkill) {
            weaponSkillHtml = `<div class="weapon-skill-name">${weapon.weaponSkill.name}: <span style="color:#666">${weapon.weaponSkill.description}</span></div>`;
        }
        let harmHtml = '';
        if (weapon.harmonization) {
            harmHtml = `<div class="weapon-resonance">谐振: ${weapon.harmonization.name}</div>`;
        }
        weaponHtml = `
            <div class="weapon-section">
                <img class="weapon-icon" src="${weaponIconUrl}" alt="${weapon.name}"
                     onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22><rect fill=%22%23333%22 width=%2264%22 height=%2264%22/></svg>'">
                <div class="weapon-info">
                    <div class="weapon-name">${weapon.name} Lv.${weapon.level} 突破${weapon.breakthrough}</div>
                    ${weaponSkillHtml}
                    ${weaponResHtml}
                    ${harmHtml}
                </div>
            </div>
        `;
    }

    // 辅助机Tab
    let cubHtml = '';
    if (cub) {
        const cubIconUrl = cub.icon ? getImageUrl(cub.icon) : '';
        let cubSkillsHtml = '';
        if (cub.skills) {
            cubSkillsHtml = cub.skills.filter(s => s.equipped).map(s => {
                const cleanDesc = (s.description || '').replace(/<color=[^>]*>/g, '').replace(/<\/color>/g, '');
                return `<div class="cub-skill">${s.name}: <span style="color:#666">${cleanDesc}</span></div>`;
            }).join('');
        }
        cubHtml = `
            <div class="cub-section">
                <img class="cub-icon" src="${cubIconUrl}" alt="${cub.name}"
                     onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22><rect fill=%22%23333%22 width=%2264%22 height=%2264%22/></svg>'">
                <div class="cub-info">
                    <div class="cub-name">${cub.customName || cub.name} Lv.${cub.level} 突破${cub.breakthrough}</div>
                    ${cubSkillsHtml}
                </div>
            </div>
        `;
    }

    html += `<div class="char-tab-content active" data-tab="skills">${skillsHtml}</div>`;
    html += `<div class="char-tab-content" data-tab="memories">${memoriesHtml}</div>`;
    html += `<div class="char-tab-content" data-tab="weapon">${weaponHtml}</div>`;
    html += `<div class="char-tab-content" data-tab="cub">${cubHtml}</div>`;

    detail.innerHTML = html;

    // Tab切换
    detail.querySelectorAll('.char-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            detail.querySelectorAll('.char-tab').forEach(t => t.classList.remove('active'));
            detail.querySelectorAll('.char-tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            detail.querySelector(`.char-tab-content[data-tab="${tab.dataset.tab}"]`).classList.add('active');
        });
    });
}

// 渲染PPC排行榜
function renderPpcRankings(ranking) {
    const container = document.getElementById('ppcRankingTable');

    // 排序
    const sorted = [...ranking];
    if (rawPpcRankings.length > 0) {
        sorted.sort((a, b) => ppcSortAsc ? a.score - b.score : b.score - a.score);
    }
    const sliced = sorted.slice(0, 100);

    const arrow = ppcSortAsc ? ' ▲' : ' ▼';

    let html = `
        <div class="ranking-header">
            <div class="col-rank">排名</div>
            <div class="col-player">玩家</div>
            <div class="col-total sortable" data-sort="ppc-total">总分<span class="sort-arrow">${arrow}</span></div>
        </div>
    `;

    const total = sliced.length;
    sliced.forEach((item, idx) => {
        const displayRank = ppcSortAsc ? total - idx : idx + 1;
        const rankClass = displayRank <= 3 ? `top-${displayRank}` : '';
        const portraitUrl = item.player.portrait ? getImageUrl(item.player.portrait) : '';
        const frameUrl = item.player.frame ? getImageUrl(item.player.frame) : '';

        html += `
            <div class="ranking-row">
                <div class="rank-num ${rankClass}">${displayRank}</div>
                <div class="player-info ranking-player" data-player-id="${item.player.id}">
                    <div class="player-avatar-sm">
                        <img src="${portraitUrl}" alt="" onerror="this.style.display='none'">
                        <img src="${frameUrl}" alt="" class="frame-sm" onerror="this.style.display='none'">
                    </div>
                    <div class="player-text">
                        <div class="player-name">${item.player.name}</div>
                        <div class="player-id-text">ID: ${item.player.id}</div>
                        <div class="guild-name">${item.player.guildName || ''}</div>
                        ${item.player.sign ? `<div class="player-sign">${item.player.sign}</div>` : ''}
                    </div>
                </div>
                <div class="total-score">${formatNumber(item.score)}</div>
            </div>
        `;
    });

    container.innerHTML = html;

    // 绑定排序点击
    container.querySelectorAll('.sortable').forEach(el => {
        el.addEventListener('click', () => {
            ppcSortAsc = !ppcSortAsc;
            renderPpcRankings(rawPpcRankings);
        });
    });

    // 绑定玩家点击事件
    container.querySelectorAll('.ranking-player').forEach(el => {
        el.addEventListener('click', () => {
            const playerId = el.dataset.playerId;
            if (playerId) {
                switchPage('player');
                loadPlayerData(playerId);
            }
        });
    });
}

// 加载PPC数据
async function loadPpcData() {
    try {
        const weekPath = currentPpcWeek || 'current';
        const url = `${API_CONFIG.ppc}/${weekPath}/${currentPpcLevel}?ranking=true`;
        const response = await fetchWithHeaders(url);
        const result = await response.json();

        if (result.status === 'success' && result.data && result.data.ppc) {
            // 记录周数范围
            if (result.data.activities) {
                minPpcWeek = result.data.activities.min;
                maxPpcWeek = result.data.activities.max;
            }
            if (currentPpcWeek === null) {
                currentPpcWeek = result.data.ppc.activity;
            }
            // 填充周数下拉框
            populateWeekSelect('ppcWeekSelect', minPpcWeek, maxPpcWeek, result.data.ppc.activity);
            populateWeekSelect('myPpcWeekSelect', minPpcWeek, maxPpcWeek, result.data.ppc.activity);
            renderPpc(result.data.ppc);
            // 保存当前PPC信息
            currentPpcInfo = {
                week: result.data.ppc.activity,
                bosses: result.data.ppc.bosses.map(b => b.name)
            };
            if (result.data.ranking) {
                rawPpcRankings = result.data.ranking;
                ppcSortAsc = false;
                renderPpcRankings(result.data.ranking);
            }
        } else {
            console.error('API返回数据格式错误:', result);
        }
    } catch (error) {
        console.error('加载PPC数据失败:', error);
    }
}

// 通过ID加载并绑定玩家
async function loadAndBindPlayer(playerId) {
    try {
        const url = `${API_CONFIG.player}/${playerId}`;
        const response = await fetchWithHeaders(url);
        const result = await response.json();

        if (result.status === 'success' && result.data && result.data.player) {
            bindPlayer(result.data.player);
        } else {
            alert('未找到该玩家');
        }
    } catch (error) {
        console.error('绑定失败:', error);
        alert('查询失败，请检查玩家ID');
    }
}

// 绑定角色功能
function getBindInfo() {
    const bind = localStorage.getItem(BIND_KEY);
    return bind ? JSON.parse(bind) : null;
}

function bindPlayer(player) {
    const bindData = {
        id: player.id,
        name: player.name,
        portrait: player.portrait
    };
    localStorage.setItem(BIND_KEY, JSON.stringify(bindData));
    renderMinePage();
    AUTH.syncToCloud('bind', bindData);
}

function unbindPlayer() {
    localStorage.removeItem(BIND_KEY);
    renderMinePage();
    AUTH.deleteFromCloud('bind');
}

// 关注列表功能
function getFollows() {
    const follows = localStorage.getItem(FOLLOW_KEY);
    return follows ? JSON.parse(follows) : [];
}

function addFollow(playerId, playerName, portrait) {
    let follows = getFollows();
    if (follows.some(f => f.id === playerId)) return;
    follows.unshift({ id: playerId, name: playerName, portrait: portrait, timestamp: Date.now() });
    if (follows.length > MAX_FOLLOWS) follows = follows.slice(0, MAX_FOLLOWS);
    localStorage.setItem(FOLLOW_KEY, JSON.stringify(follows));
    renderFollows();
    AUTH.syncToCloud('follows', follows);
}

function removeFollow(playerId) {
    let follows = getFollows().filter(f => f.id !== playerId);
    localStorage.setItem(FOLLOW_KEY, JSON.stringify(follows));
    renderFollows();
    AUTH.syncToCloud('follows', follows);
}

function clearFollows() {
    localStorage.removeItem(FOLLOW_KEY);
    renderFollows();
    AUTH.deleteFromCloud('follows');
}

// 渲染关注列表
function renderFollows() {
    const container = document.getElementById('followList');
    const follows = getFollows();

    if (follows.length === 0) {
        container.innerHTML = '<div class="follow-empty">暂无关注</div>';
        return;
    }

    let html = '';
    follows.forEach(item => {
        const portraitUrl = item.portrait ? getImageUrl(item.portrait) : '';
        html += `
            <div class="follow-item">
                <img class="follow-avatar" src="${portraitUrl}" alt="${item.name}"
                     onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 36 36%22><rect fill=%22%23333%22 width=%2236%22 height=%2236%22/></svg>'">
                <div class="follow-info">
                    <div class="follow-name">${item.name}</div>
                    <div class="follow-id">ID: ${item.id}</div>
                </div>
                <div class="follow-actions">
                    <button class="follow-action-btn" data-action="view" data-id="${item.id}">查看</button>
                    <button class="follow-action-btn" data-action="unfollow" data-id="${item.id}">取关</button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;

    container.querySelectorAll('.follow-action-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const action = btn.dataset.action;
            if (action === 'view') {
                document.getElementById('playerIdInput').value = id;
                loadPlayerData(id);
                switchPage('player');
            } else if (action === 'unfollow') {
                removeFollow(id);
            }
        });
    });
}

// 得分管理
function getScores(key) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
}

function saveScores(key, scores) {
    localStorage.setItem(key, JSON.stringify(scores));
}

// 战区分数评价
function evaluateWzScore(total) {
    if (total >= 80000000) return { text: '传奇顶级肘子', level: 6 };
    if (total >= 50000000) return { text: '传奇大肘子', level: 5 };
    if (total >= 40000000) return { text: '传奇中肘子', level: 4 };
    if (total >= 30000000) return { text: '传奇区小肘子', level: 3 };
    if (total >= 15000000) return { text: '保送传奇', level: 2 };
    if (total >= 10000000) return { text: '会放人物技能', level: 1 };
    return { text: '菜福', level: 0 };
}

function getEvaluationDesc(level) {
    const descs = [
        '英雄区保不了级系列',
        '运气好英雄区保级',
        '',
        '',
        '',
        '',
        ''
    ];
    return descs[level] || '';
}

function renderWzEvaluation(total) {
    const container = document.getElementById('wzEvaluation');
    if (!container || total <= 0) {
        if (container) container.innerHTML = '';
        return;
    }
    const ev = evaluateWzScore(total);
    const desc = getEvaluationDesc(ev.level);
    container.innerHTML = `
        <div class="eval-tag eval-level-${ev.level}">${ev.text}</div>
        ${desc ? `<div class="eval-desc">${desc}</div>` : ''}
    `;
}

function saveWzScore() {
    if (!currentWarzoneInfo) return;
    if (myWzWeek !== maxWeek) return; // 只能保存本周

    const inputs = document.querySelectorAll('.wz-score-input');
    const scores = [];
    let total = 0;
    inputs.forEach((input, i) => {
        const val = parseInt(input.value) || 0;
        const zone = currentWarzoneInfo.zones[i];
        scores.push({
            name: zone.name,
            score: val,
            desc: zone.desc,
            buffs: zone.buffs
        });
        total += val;
    });
    if (total === 0) return;

    let allScores = getScores(WZ_SCORE_KEY);
    allScores = allScores.filter(s => s.week !== myWzWeek);
    allScores.unshift({
        week: myWzWeek,
        zones: scores,
        total: total,
        timestamp: Date.now()
    });
    if (allScores.length > 20) allScores = allScores.slice(0, 20);
    saveScores(WZ_SCORE_KEY, allScores);
    renderWzHistory();
    renderWzEvaluation(total);
    AUTH.syncToCloud('wz_scores', allScores);
}

function savePpcScore() {
    if (!currentPpcInfo) return;
    if (myPpcWeek !== maxPpcWeek) return; // 只能保存本周

    const inputs = document.querySelectorAll('.ppc-score-input');
    const scores = [];
    let total = 0;
    inputs.forEach((input, i) => {
        const val = parseInt(input.value) || 0;
        scores.push({ name: currentPpcInfo.bosses[i], score: val });
        total += val;
    });
    if (total === 0) return;

    let allScores = getScores(PPC_SCORE_KEY);
    allScores = allScores.filter(s => s.week !== myPpcWeek);
    allScores.unshift({
        week: myPpcWeek,
        bosses: scores,
        total: total,
        timestamp: Date.now()
    });
    if (allScores.length > 20) allScores = allScores.slice(0, 20);
    saveScores(PPC_SCORE_KEY, allScores);
    renderPpcHistory();
    AUTH.syncToCloud('ppc_scores', allScores);
}

function renderWzHistory() {
    const container = document.getElementById('wzHistory');
    const scores = getScores(WZ_SCORE_KEY);
    if (scores.length === 0) {
        container.innerHTML = '';
        return;
    }

    let html = '<div class="score-history-title">历史记录</div>';
    html += '<table class="score-table"><thead><tr><th>周</th>';
    // 动态表头：用最近一条数据的区名
    const latest = scores[0];
    latest.zones.forEach(z => {
        const monsterTag = getMonsterTag(z.desc);
        html += `<th>${z.name}${monsterTag ? `(${monsterTag})` : ''}</th>`;
    });
    html += '<th>总分</th><th></th></tr></thead><tbody>';

    scores.forEach(s => {
        html += `<tr><td>第${s.week}周</td>`;
        s.zones.forEach(z => {
            html += `<td>${formatNumber(z.score)}</td>`;
        });
        html += `<td class="score-total">${formatNumber(s.total)}</td>`;
        html += `<td><button class="score-delete" data-week="${s.week}" data-type="wz">删除</button></td>`;
        html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;

    container.querySelectorAll('.score-delete').forEach(btn => {
        btn.addEventListener('click', () => {
            const week = parseInt(btn.dataset.week);
            let allScores = getScores(WZ_SCORE_KEY).filter(s => s.week !== week);
            saveScores(WZ_SCORE_KEY, allScores);
            renderWzHistory();
        });
    });
}

function renderPpcHistory() {
    const container = document.getElementById('ppcHistory');
    const scores = getScores(PPC_SCORE_KEY);
    if (scores.length === 0) {
        container.innerHTML = '';
        return;
    }

    let html = '<div class="score-history-title">历史记录</div>';
    html += '<table class="score-table"><thead><tr><th>周</th>';
    const maxBosses = Math.max(...scores.map(s => s.bosses.length));
    for (let i = 0; i < maxBosses; i++) {
        html += `<th>Boss${i + 1}</th>`;
    }
    html += '<th>总分</th><th></th></tr></thead><tbody>';

    scores.forEach(s => {
        html += `<tr><td>第${s.week}周</td>`;
        s.bosses.forEach(b => {
            html += `<td>${formatNumber(b.score)}</td>`;
        });
        html += `<td class="score-total">${formatNumber(s.total)}</td>`;
        html += `<td><button class="score-delete" data-week="${s.week}" data-type="ppc">删除</button></td>`;
        html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;

    container.querySelectorAll('.score-delete').forEach(btn => {
        btn.addEventListener('click', () => {
            const week = parseInt(btn.dataset.week);
            let allScores = getScores(PPC_SCORE_KEY).filter(s => s.week !== week);
            saveScores(PPC_SCORE_KEY, allScores);
            renderPpcHistory();
        });
    });
}

// 加载指定周的战区数据
async function loadMyWzWeek(week) {
    try {
        const url = `${API_CONFIG.warzone}/${week}/${currentDifficulty}`;
        const response = await fetchWithHeaders(url);
        const result = await response.json();
        if (result.status === 'success' && result.data && result.data.warzone) {
            const wz = result.data.warzone;
            myWzWeek = wz.activity;
            currentWarzoneInfo = {
                week: wz.activity,
                zones: wz.area.zones.map(z => ({ name: z.name, desc: z.description, buffs: z.buffs }))
            };
            renderWzScoreInputs();
        }
    } catch (error) {
        console.error('加载战区数据失败:', error);
    }
}

// 加载指定周的PPC数据
async function loadMyPpcWeek(week) {
    try {
        const url = `${API_CONFIG.ppc}/${week}/${currentPpcLevel}`;
        const response = await fetchWithHeaders(url);
        const result = await response.json();
        if (result.status === 'success' && result.data && result.data.ppc) {
            const ppc = result.data.ppc;
            myPpcWeek = ppc.activity;
            currentPpcInfo = {
                week: ppc.activity,
                bosses: ppc.bosses.map(b => b.name)
            };
            renderPpcScoreInputs();
        }
    } catch (error) {
        console.error('加载PPC数据失败:', error);
    }
}

function renderWzScoreInputs() {
    const wzGrid = document.getElementById('wzInputGrid');
    const saveBtn = document.getElementById('saveWzBtn');
    if (!currentWarzoneInfo) return;

    const isCurrentWeek = myWzWeek === maxWeek;

    // 同步下拉框选中项
    const myWzSelect = document.getElementById('myWzWeekSelect');
    if (myWzSelect.querySelector(`option[value="${currentWarzoneInfo.week}"]`)) {
        myWzSelect.value = currentWarzoneInfo.week;
    }
    const existing = getScores(WZ_SCORE_KEY).find(s => s.week === currentWarzoneInfo.week);
    let html = '';
    currentWarzoneInfo.zones.forEach((zone, i) => {
        const val = existing && existing.zones[i] ? existing.zones[i].score : '';
        const monsterTag = getMonsterTag(zone.desc);
        const subLabel = zone.buffs && zone.buffs.length >= 2
            ? ` <span class="zone-sub-label">${zone.buffs.map(b => b.name).join(' / ')}</span>`
            : '';
        if (isCurrentWeek) {
            html += `
                <div class="score-input-item">
                    <div class="score-input-label">${zone.name}${subLabel}${monsterTag ? ` <span class="zone-tag">${monsterTag}</span>` : ''}</div>
                    <input class="score-input-field wz-score-input" type="number" placeholder="0" value="${val}">
                </div>
            `;
        } else {
            const displayVal = val !== '' ? formatNumber(val) : '--';
            html += `
                <div class="score-input-item score-readonly">
                    <div class="score-input-label">${zone.name}${subLabel}${monsterTag ? ` <span class="zone-tag">${monsterTag}</span>` : ''}</div>
                    <div class="score-readonly-val">${displayVal}</div>
                </div>
            `;
        }
    });
    wzGrid.innerHTML = html;

    // 本周显示保存按钮，过去周隐藏
    saveBtn.style.display = isCurrentWeek ? '' : 'none';

    // 有已保存分数时显示评价，否则清空
    renderWzEvaluation(existing ? existing.total : 0);
}

function renderPpcScoreInputs() {
    const ppcGrid = document.getElementById('ppcInputGrid');
    const saveBtn = document.getElementById('savePpcBtn');
    if (!currentPpcInfo) return;

    const isCurrentWeek = myPpcWeek === maxPpcWeek;

    // 同步下拉框选中项
    const myPpcSelect = document.getElementById('myPpcWeekSelect');
    if (myPpcSelect.querySelector(`option[value="${currentPpcInfo.week}"]`)) {
        myPpcSelect.value = currentPpcInfo.week;
    }
    const existing = getScores(PPC_SCORE_KEY).find(s => s.week === currentPpcInfo.week);
    let html = '';
    currentPpcInfo.bosses.forEach((name, i) => {
        const val = existing ? existing.bosses[i].score : '';
        if (isCurrentWeek) {
            html += `
                <div class="score-input-item">
                    <div class="score-input-label">${name}</div>
                    <input class="score-input-field ppc-score-input" type="number" placeholder="0" value="${val}">
                </div>
            `;
        } else {
            const displayVal = val !== '' ? formatNumber(val) : '--';
            html += `
                <div class="score-input-item score-readonly">
                    <div class="score-input-label">${name}</div>
                    <div class="score-readonly-val">${displayVal}</div>
                </div>
            `;
        }
    });
    ppcGrid.innerHTML = html;

    // 本周显示保存按钮，过去周隐藏
    saveBtn.style.display = isCurrentWeek ? '' : 'none';
}

function renderScoreInputs() {
    // 战区：使用当前已加载的数据
    if (currentWarzoneInfo) {
        myWzWeek = currentWarzoneInfo.week;
        renderWzScoreInputs();
    }

    // PPC：使用当前已加载的数据
    if (currentPpcInfo) {
        myPpcWeek = currentPpcInfo.week;
        renderPpcScoreInputs();
    }

    renderWzHistory();
    renderPpcHistory();
}

// 渲染我的页面
async function renderMinePage() {
    // 已登录时先从云端拉取最新数据
    if (AUTH.isLoggedIn()) {
        await AUTH._pullFromCloud();
    }

    const bind = getBindInfo();
    const bindEmpty = document.getElementById('bindEmpty');
    const bindPlayer = document.getElementById('bindPlayer');
    const myCharsSection = document.getElementById('myCharsSection');

    if (!bind) {
        bindEmpty.style.display = 'block';
        bindPlayer.style.display = 'none';
        myCharsSection.style.display = 'none';
        return;
    }

    bindEmpty.style.display = 'none';
    bindPlayer.style.display = 'flex';
    document.getElementById('bindName').textContent = bind.name;
    document.getElementById('bindId').textContent = bind.id;
    document.getElementById('bindAvatar').src = bind.portrait ? getImageUrl(bind.portrait) : '';

    // 加载角色数据
    try {
        const url = `${API_CONFIG.player}/${bind.id}`;
        const response = await fetchWithHeaders(url);
        const result = await response.json();

        if (result.status === 'success' && result.data && result.data.characters) {
            const characters = result.data.characters.filter(c => c.acquired);
            document.getElementById('myCharCount').textContent = `(${characters.length})`;
            renderMyChars(characters);
            myCharsSection.style.display = 'block';
        }
    } catch (error) {
        console.error('加载角色数据失败:', error);
    }

    renderFollows();
    renderScoreInputs();
}

// 渲染我的角色
function renderMyChars(characters) {
    const container = document.getElementById('myCharsGrid');
    let html = '';

    characters.forEach(char => {
        const iconUrl = char.fashionIcon ? getImageUrl(char.fashionIcon) : '';
        const isHidden = char.level === 0;
        const levelText = char.level > 0 ? `Lv.${char.level}` : '';
        const qualityInfo = getQualityInfo(char.quality);

        html += `
            <div class="character-card${isHidden ? ' character-hidden' : ''}" data-char-id="${char.id}" style="cursor:pointer;">
                <div class="character-icon">
                    <img src="${iconUrl}" alt="${char.characterName}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22><rect fill=%22%23333%22 width=%2264%22 height=%2264%22/></svg>'">
                </div>
                <div class="character-info">
                    <div class="character-name">${char.characterName}<span class="character-frame">${char.frameName}</span>${isHidden ? ' <span class="hidden-tag">隐藏</span>' : ''}</div>
                    ${isHidden ? '' : `<div class="character-stats">
                        ${levelText ? `<span>${levelText}</span>` : ''}
                        ${qualityInfo ? `<span class="quality-tag quality-${char.quality}">${qualityInfo}</span>` : ''}
                    </div>`}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;

    container.querySelectorAll('.character-card').forEach(card => {
        card.addEventListener('click', () => {
            const charId = card.dataset.charId;
            const bind = getBindInfo();
            if (bind) {
                currentPlayerId = bind.id;
                loadCharacterDetail(charId);
            }
        });
    });
}

// 页面切换辅助函数
function switchPage(pageName) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelector(`.nav-btn[data-page="${pageName}"]`).classList.add('active');
    document.getElementById(`${pageName}Page`).classList.add('active');
    localStorage.setItem('currentPage', pageName);
}

// 初始化导航和选择器
function initNavigation() {
    // 页面导航
    const navBtns = document.querySelectorAll('.nav-btn');
    const pages = document.querySelectorAll('.page');

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetPage = btn.dataset.page;
            switchPage(targetPage);
            if (targetPage === 'mine') {
                renderMinePage();
            }
        });
    });

    // 战区难度选择器
    const difficultySelect = document.getElementById('difficultySelect');
    difficultySelect.value = currentDifficulty;

    difficultySelect.addEventListener('change', (e) => {
        currentDifficulty = e.target.value;
        localStorage.setItem('currentDifficulty', currentDifficulty);
        loadWarzoneData();
    });

    // 战区周数下拉
    document.getElementById('weekSelect').addEventListener('change', (e) => {
        currentWeek = parseInt(e.target.value);
        loadWarzoneData();
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

    // 清除历史
    const clearHistoryBtn = document.getElementById('clearHistory');
    clearHistoryBtn.addEventListener('click', () => {
        if (confirm('确定要清空查询历史吗？')) {
            clearHistory();
        }
    });

    // 渲染历史列表
    renderHistory();

    // 幻痛囚笼选择器
    const ppcLevelSelect = document.getElementById('ppcLevelSelect');
    ppcLevelSelect.value = currentPpcLevel;

    ppcLevelSelect.addEventListener('change', (e) => {
        currentPpcLevel = e.target.value;
        localStorage.setItem('currentPpcLevel', currentPpcLevel);
        loadPpcData();
    });

    // PPC周数下拉
    document.getElementById('ppcWeekSelect').addEventListener('change', (e) => {
        currentPpcWeek = parseInt(e.target.value);
        loadPpcData();
    });

    // 刷新按钮（10秒冷却）
    let lastWzRefresh = 0;
    let lastPpcRefresh = 0;
    const REFRESH_COOLDOWN = 10000;

    function handleRefresh(btn, lastTime, callback) {
        const now = Date.now();
        if (now - lastTime < REFRESH_COOLDOWN) {
            const remaining = Math.ceil((REFRESH_COOLDOWN - (now - lastTime)) / 1000);
            btn.textContent = `${remaining}秒`;
            btn.disabled = true;
            setTimeout(() => {
                btn.textContent = '刷新';
                btn.disabled = false;
            }, REFRESH_COOLDOWN - (now - lastTime));
            return lastTime;
        }
        callback();
        return now;
    }

    document.getElementById('refreshWzBtn').addEventListener('click', () => {
        lastWzRefresh = handleRefresh(document.getElementById('refreshWzBtn'), lastWzRefresh, () => {
            currentWeek = null;
            loadWarzoneData();
        });
    });
    document.getElementById('refreshPpcBtn').addEventListener('click', () => {
        lastPpcRefresh = handleRefresh(document.getElementById('refreshPpcBtn'), lastPpcRefresh, () => {
            currentPpcWeek = null;
            loadPpcData();
        });
    });

    // 我的页面
    document.getElementById('bindByIdBtn').addEventListener('click', () => {
        const id = document.getElementById('bindIdInput').value.trim();
        if (id) {
            loadAndBindPlayer(id);
        }
    });

    document.getElementById('bindIdInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const id = document.getElementById('bindIdInput').value.trim();
            if (id) {
                loadAndBindPlayer(id);
            }
        }
    });

    document.getElementById('unbindBtn').addEventListener('click', () => {
        if (confirm('确定要解绑角色吗？')) {
            unbindPlayer();
        }
    });

    document.getElementById('viewBindPlayer').addEventListener('click', () => {
        const bind = getBindInfo();
        if (bind) {
            document.getElementById('playerIdInput').value = bind.id;
            loadPlayerData(bind.id);
            switchPage('player');
        }
    });

    document.getElementById('clearFollows').addEventListener('click', () => {
        if (confirm('确定要清空关注列表吗？')) {
            clearFollows();
        }
    });

    document.getElementById('saveWzBtn').addEventListener('click', () => {
        saveWzScore();
        alert('战区分数已保存');
    });

    document.getElementById('savePpcBtn').addEventListener('click', () => {
        savePpcScore();
        alert('幻痛分数已保存');
    });

    // 我的页面-战区周下拉
    document.getElementById('myWzWeekSelect').addEventListener('change', (e) => {
        myWzWeek = parseInt(e.target.value);
        loadMyWzWeek(myWzWeek);
    });

    // 我的页面-PPC周下拉
    document.getElementById('myPpcWeekSelect').addEventListener('change', (e) => {
        myPpcWeek = parseInt(e.target.value);
        loadMyPpcWeek(myPpcWeek);
    });

    // 战区历史查询
    document.getElementById('zoneHistorySearchBtn').addEventListener('click', searchZoneHistory);

    // 数据管理
    document.getElementById('exportDataBtn').addEventListener('click', exportAllData);
    document.getElementById('importDataBtn').addEventListener('click', () => {
        document.getElementById('importFileInput').click();
    });
    document.getElementById('importFileInput').addEventListener('change', handleImportFile);

    // 登录/注册
    const loginBtn = document.getElementById('loginBtn');
    const loginIdInput = document.getElementById('loginIdInput');
    const loginPwInput = document.getElementById('loginPwInput');
    const loginError = document.getElementById('loginError');

    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            const playerId = loginIdInput.value.trim();
            const password = loginPwInput.value.trim();
            loginError.textContent = '';

            if (!playerId || !password) {
                loginError.textContent = '请输入游戏ID和密码';
                return;
            }

            loginBtn.disabled = true;
            loginBtn.textContent = '登录中...';

            try {
                await AUTH.login(playerId, password);
                loginIdInput.value = '';
                loginPwInput.value = '';
                loginError.textContent = '';
                renderMinePage();
            } catch (error) {
                loginError.textContent = error.message;
            } finally {
                loginBtn.disabled = false;
                loginBtn.textContent = '登 录';
            }
        });

        // Enter 键登录
        loginPwInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') loginBtn.click();
        });
        loginIdInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') loginPwInput.focus();
        });
    }

    // 退出登录
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (confirm('确定要退出登录吗？')) {
                AUTH.logout();
                renderMinePage();
            }
        });
    }
}

// ========== 战区历史查询 ==========
let zoneHistorySearching = false;

// 填充区名下拉框
function populateZoneNameSelect() {
    const select = document.getElementById('zoneNameSelect');
    if (!select) return;

    const allNames = new Set();

    // 从当前 zonesData 收集区名
    zonesData.forEach(z => {
        if (z.name !== '熵钟异数') allNames.add(z.name);
        if (z.buffs) z.buffs.forEach(b => allNames.add(b.name));
    });

    // 从本地历史数据中收集区名
    if (window.__wzHistoryData) {
        window.__wzHistoryData.forEach(w => {
            w.zones.forEach(z => {
                if (z.name !== '熵钟异数') allNames.add(z.name);
                if (z.buffs) z.buffs.forEach(b => allNames.add(b.name));
            });
        });
    }

    // 保存当前选中值
    const currentVal = select.value;

    let html = '';
    [...allNames].sort().forEach(name => {
        html += `<option value="${name}">${name}</option>`;
    });
    select.innerHTML = html;

    // 恢复选中
    if (currentVal && select.querySelector(`option[value="${currentVal}"]`)) {
        select.value = currentVal;
    }
}

// 从本地JSON数据中提取匹配结果（紧凑格式）
function extractWeekResult(weekData, zoneName, monsterTag, myId) {
    const zones = weekData.zones;
    const rankings = weekData.rankings;

    // 找到匹配的区
    let targetZone = null;
    for (const z of zones) {
        if (z.name === zoneName) {
            const tag = getMonsterTag(z.desc);
            if (tag === monsterTag) { targetZone = z; break; }
        }
        if (z.buffs && z.buffs.length >= 2) {
            for (const b of z.buffs) {
                if (b.name === zoneName) {
                    const tag = getMonsterTag(z.desc);
                    if (tag === monsterTag) { targetZone = z; break; }
                }
            }
            if (targetZone) break;
        }
    }

    if (!targetZone) return null;

    let topPlayer = null;
    let myBest = null;

    for (const r of rankings) {
        const zoneData = r.z.find(z => z.id === targetZone.id);
        if (!zoneData) continue;

        if (!topPlayer || zoneData.s > topPlayer.score) {
            topPlayer = {
                name: r.pn,
                id: r.pid,
                score: zoneData.s,
                characters: zoneData.c || []
            };
        }

        if (myId && r.pid === parseInt(myId)) {
            if (!myBest || zoneData.s > myBest.score) {
                myBest = { score: zoneData.s };
            }
        }
    }

    return { topPlayer, myBest };
}

// 主查询函数（从本地JSON读取，0网络请求）
async function searchZoneHistory() {
    if (zoneHistorySearching) return;

    const zoneName = document.getElementById('zoneNameSelect').value;
    const monsterTag = document.getElementById('monsterCountSelect').value;
    const resultDiv = document.getElementById('zoneHistoryResult');
    const searchBtn = document.getElementById('zoneHistorySearchBtn');

    if (!zoneName) {
        resultDiv.innerHTML = '<div class="zone-history-loading">请选择战区</div>';
        return;
    }

    // 检查本地数据是否加载
    if (!window.__wzHistoryData) {
        resultDiv.innerHTML = '<div class="zone-history-loading">历史数据加载中，请稍后再试</div>';
        return;
    }

    zoneHistorySearching = true;
    searchBtn.disabled = true;
    searchBtn.textContent = '查询中...';

    const bind = getBindInfo();
    const myId = bind ? bind.id : null;

    // 直接从本地JSON遍历
    const historyData = window.__wzHistoryData;
    let topPlayer = null;
    let topWeek = null;
    let myBest = null;
    let myWeek = null;

    resultDiv.innerHTML = `<div class="zone-history-loading">正在查询 0/${historyData.length} 周...</div>`;

    for (let i = 0; i < historyData.length; i++) {
        const weekData = historyData[i];
        const result = extractWeekResult(weekData, zoneName, monsterTag, myId);

        if (result) {
            if (result.topPlayer && (!topPlayer || result.topPlayer.score > topPlayer.score)) {
                topPlayer = result.topPlayer;
                topWeek = weekData.week;
            }
            if (result.myBest && (!myBest || result.myBest.score > myBest.score)) {
                myBest = result.myBest;
                myWeek = weekData.week;
            }
        }

        // 每10周更新一次进度
        if ((i + 1) % 10 === 0) {
            resultDiv.innerHTML = `<div class="zone-history-loading">正在查询 ${i + 1}/${historyData.length} 周...</div>`;
            await new Promise(r => setTimeout(r, 0)); // 让出UI线程
        }
    }

    // 从本地保存的分数中查找我的最高（排行榜TOP100之外的补充）
    const myScores = getScores(WZ_SCORE_KEY);
    for (const record of myScores) {
        if (!record.zones) continue;
        for (const z of record.zones) {
            if (z.name === zoneName && z.desc) {
                const tag = getMonsterTag(z.desc);
                if (tag === monsterTag && z.score > 0) {
                    if (!myBest || z.score > myBest.score) {
                        myBest = { score: z.score };
                        myWeek = record.week;
                    }
                }
            }
        }
    }

    // 渲染结果
    const cached = {
        topPlayer: topPlayer ? { ...topPlayer, week: topWeek } : null,
        myBest: myBest ? { ...myBest, week: myWeek } : null
    };
    renderZoneHistoryResult(zoneName, monsterTag, cached);

    zoneHistorySearching = false;
    searchBtn.disabled = false;
    searchBtn.textContent = '查询';
}

// 渲染查询结果
function renderZoneHistoryResult(zoneName, monsterTag, cached) {
    const resultDiv = document.getElementById('zoneHistoryResult');

    if (!cached.topPlayer && !cached.myBest) {
        resultDiv.innerHTML = '<div class="zone-history-loading">未找到该战区+怪物组合的数据</div>';
        return;
    }

    let html = `<div class="zone-history-card">`;
    html += `<div class="zone-history-title">${zoneName} · ${monsterTag}</div>`;

    // 全服最高
    if (cached.topPlayer) {
        html += `
            <div class="zone-history-record">
                <div class="zone-history-label">全服最高</div>
                <div class="zone-history-score">${formatNumber(cached.topPlayer.score)}</div>
                <div class="zone-history-meta">${cached.topPlayer.name} · 第${cached.topPlayer.week}周</div>
            </div>
        `;
    }

    // 我的最高
    const bind = getBindInfo();
    if (bind) {
        if (cached.myBest) {
            html += `
                <div class="zone-history-record">
                    <div class="zone-history-label">我的最高</div>
                    <div class="zone-history-score my-score">${formatNumber(cached.myBest.score)}</div>
                    <div class="zone-history-meta">第${cached.myBest.week}周</div>
                </div>
            `;
        } else {
            html += `
                <div class="zone-history-record">
                    <div class="zone-history-label">我的最高</div>
                    <div class="zone-history-meta">暂无记录（在排行榜前100中未找到）</div>
                </div>
            `;
        }
    }

    html += '</div>';
    resultDiv.innerHTML = html;
}

// ========== 数据导入导出 ==========
function exportAllData() {
    const data = {
        version: 1,
        exportedAt: new Date().toISOString(),
        player_bind: localStorage.getItem(BIND_KEY),
        player_search_history: localStorage.getItem(HISTORY_KEY),
        player_follows: localStorage.getItem(FOLLOW_KEY),
        my_wz_scores: localStorage.getItem(WZ_SCORE_KEY),
        my_ppc_scores: localStorage.getItem(PPC_SCORE_KEY)
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    a.href = url;
    a.download = `huaxu-data-${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);

    const msg = document.getElementById('dataMgmtMsg');
    msg.textContent = '导出成功';
    msg.style.color = '#aaa';
    setTimeout(() => { msg.textContent = ''; }, 3000);
}

function handleImportFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = function(ev) {
        try {
            const data = JSON.parse(ev.target.result);
            if (!data.version) {
                alert('无效的数据文件');
                return;
            }

            const keys = [
                { key: BIND_KEY, field: 'player_bind', label: '绑定角色' },
                { key: HISTORY_KEY, field: 'player_search_history', label: '搜索历史' },
                { key: FOLLOW_KEY, field: 'player_follows', label: '关注列表' },
                { key: WZ_SCORE_KEY, field: 'my_wz_scores', label: '战区分数' },
                { key: PPC_SCORE_KEY, field: 'my_ppc_scores', label: '幻痛分数' }
            ];

            let imported = 0;
            let skipped = 0;

            keys.forEach(({ key, field, label }) => {
                const newVal = data[field];
                if (!newVal) return;

                const existing = localStorage.getItem(key);
                if (!existing) {
                    localStorage.setItem(key, newVal);
                    imported++;
                    return;
                }

                try {
                    const existingArr = JSON.parse(existing);
                    const newArr = JSON.parse(newVal);

                    if (!Array.isArray(existingArr) || !Array.isArray(newArr)) {
                        // 非数组，直接跳过（不覆盖）
                        skipped++;
                        return;
                    }

                    // 合并去重
                    let merged;
                    if (key === HISTORY_KEY) {
                        // 搜索历史按 id 去重
                        const existIds = new Set(existingArr.map(i => i.id));
                        const toAdd = newArr.filter(i => !existIds.has(i.id));
                        merged = [...existingArr, ...toAdd].slice(0, MAX_HISTORY);
                    } else if (key === FOLLOW_KEY) {
                        // 关注列表按 id 去重
                        const existIds = new Set(existingArr.map(i => i.id));
                        const toAdd = newArr.filter(i => !existIds.has(i.id));
                        merged = [...existingArr, ...toAdd].slice(0, MAX_FOLLOWS);
                    } else if (key === WZ_SCORE_KEY) {
                        // 战区分数按 week 去重
                        const existWeeks = new Set(existingArr.map(i => i.week));
                        const toAdd = newArr.filter(i => !existWeeks.has(i.week));
                        merged = [...existingArr, ...toAdd];
                    } else if (key === PPC_SCORE_KEY) {
                        // 幻痛分数按 week 去重
                        const existWeeks = new Set(existingArr.map(i => i.week));
                        const toAdd = newArr.filter(i => !existWeeks.has(i.week));
                        merged = [...existingArr, ...toAdd];
                    } else {
                        skipped++;
                        return;
                    }

                    localStorage.setItem(key, JSON.stringify(merged));
                    imported++;
                } catch {
                    skipped++;
                }
            });

            const msg = document.getElementById('dataMgmtMsg');
            msg.textContent = `导入完成：${imported} 项已导入，${skipped} 项跳过`;
            msg.style.color = '#aaa';
            setTimeout(() => { msg.textContent = ''; }, 5000);

            // 刷新我的页面
            renderMinePage();

            // 导入后如已登录则同步到云端
            if (AUTH.isLoggedIn()) {
                AUTH._pushToCloud();
            }
        } catch {
            alert('文件解析失败，请检查JSON格式');
        }
    };
    reader.readAsText(file);
}

// 页面加载完成后获取数据
document.addEventListener('DOMContentLoaded', async () => {
    initNavigation();
    initModal();

    // 初始化认证状态
    await AUTH.init();

    loadWarzoneData();
    loadPpcData();

    // 恢复上次浏览的页面
    const savedPage = localStorage.getItem('currentPage');
    if (savedPage && document.getElementById(`${savedPage}Page`)) {
        switchPage(savedPage);
        if (savedPage === 'mine') renderMinePage();
    }

    // 自动检查更新战区历史数据
    setTimeout(checkAndUpdateHistory, 3000);
});

// ========== 战区历史数据自动更新 ==========
// 浏览器环境用 localStorage 缓存更新后的数据，Electron 用 IPC 写文件
const HISTORY_CACHE_KEY = 'huaxu_wz_history_cache';

async function checkAndUpdateHistory() {
    try {
        if (!window.__wzHistoryData || !Array.isArray(window.__wzHistoryData)) return;
        const localMax = Math.max(...window.__wzHistoryData.map(d => d.week));
        console.log('[历史更新] 本地最大周:', localMax);

        // 获取当前周号
        const resp = await fetchWithHeaders(`${API_CONFIG.warzone}/current/${currentDifficulty}`);
        const result = await resp.json();
        if (result.status !== 'success' || !result.data) return;
        const remoteWeek = result.data.warzone.activity;
        console.log('[历史更新] 远程当前周:', remoteWeek);

        let needSave = false;

        // 补采缺失的周
        const newWeeks = [];
        for (let w = localMax + 1; w <= remoteWeek; w++) {
            try {
                const resp = await fetchWithHeaders(`${API_CONFIG.warzone}/${w}/${currentDifficulty}`);
                const d = await resp.json();
                if (d.status === 'success' && d.data && d.data.warzone) {
                    const wz = d.data.warzone;
                    const rankingsData = d.data.rankings || [];
                    newWeeks.push({
                        week: wz.week || wz.activity,
                        zones: wz.area.zones.map(z => ({
                            id: z.id,
                            name: z.name,
                            desc: z.description || '',
                            buffs: (z.buffs || []).map(b => ({ name: b.name, desc: b.description || '' }))
                        })),
                        rankings: rankingsData.slice(0, 100).map(rank => ({
                            pid: rank.player.id,
                            pn: rank.player.name,
                            pg: rank.player.guildName || '',
                            pp: rank.player.portrait || '',
                            pf: rank.player.frame || '',
                            s: rank.score,
                            z: (rank.zones || []).map(z => ({
                                id: z.id,
                                s: z.score,
                                c: (z.characters || []).map(c => ({
                                    n: c.name,
                                    i: c.icon,
                                    b: c.bp,
                                    ci: c.cubIcon || '',
                                    cn: c.cubName || ''
                                }))
                            }))
                        }))
                    });
                }
            } catch { /* 单周失败跳过 */ }
        }

        if (newWeeks.length > 0) {
            window.__wzHistoryData.push(...newWeeks);
            needSave = true;
        }

        // 强制刷新最新周的排行榜（本周分数还在变化）
        try {
            const latestResp = await fetchWithHeaders(`${API_CONFIG.warzone}/${remoteWeek}/${currentDifficulty}`);
            const latestData = await latestResp.json();
            if (latestData.status === 'success' && latestData.data && latestData.data.warzone) {
                const wz = latestData.data.warzone;
                const latestRankings = latestData.data.rankings || [];
                const latestEntry = {
                    week: wz.week || wz.activity,
                    zones: wz.area.zones.map(z => ({
                        id: z.id,
                        name: z.name,
                        desc: z.description || '',
                        buffs: (z.buffs || []).map(b => ({ name: b.name, desc: b.description || '' }))
                    })),
                    rankings: latestRankings.slice(0, 100).map(rank => ({
                        pid: rank.player.id,
                        pn: rank.player.name,
                        pg: rank.player.guildName || '',
                        pp: rank.player.portrait || '',
                        pf: rank.player.frame || '',
                        s: rank.score,
                        z: (rank.zones || []).map(z => ({
                            id: z.id,
                            s: z.score,
                            c: (z.characters || []).map(c => ({
                                n: c.name,
                                i: c.icon,
                                b: c.bp,
                                ci: c.cubIcon || '',
                                cn: c.cubName || ''
                            }))
                        }))
                    }))
                };

                // 替换或添加最新周数据
                const existIdx = window.__wzHistoryData.findIndex(d => d.week === remoteWeek);
                if (existIdx >= 0) {
                    window.__wzHistoryData[existIdx] = latestEntry;
                } else {
                    window.__wzHistoryData.push(latestEntry);
                }
                needSave = true;
            }
        } catch { /* 最新周刷新失败跳过 */ }

        console.log('[历史更新] needSave:', needSave);
        if (needSave) {
            window.__wzHistoryData.sort((a, b) => a.week - b.week);

            // 持久化保存
            if (window.electronAPI && window.electronAPI.isElectron) {
                // Electron: 写回 userData 文件
                await window.electronAPI.saveHistoryData(window.__wzHistoryData);
            } else {
                // 浏览器: 存入 localStorage（压缩后可能较大，但通常够用）
                try {
                    localStorage.setItem(HISTORY_CACHE_KEY, JSON.stringify(window.__wzHistoryData));
                } catch {
                    // localStorage 空间不足时静默失败
                    console.warn('历史数据缓存失败，localStorage 空间可能不足');
                }
            }

            // 刷新区名下拉框
            if (typeof populateZoneNameSelect === 'function') populateZoneNameSelect();
        }
    } catch (err) { console.error('[历史更新] 失败:', err); }
}
