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

// 紧凑格式：大数用万显示
function formatScoreCompact(num) {
    if (num >= 100000000) return (num / 100000000).toFixed(1) + '亿';
    if (num >= 10000) return (num / 10000).toFixed(1) + '万';
    return String(num);
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

// 创建战区卡片HTML（单行紧凑版：区名+怪物数量+详情按钮）
function createZoneCard(zone, index) {
    const monsterTag = getMonsterTag(zone.description);
    const isMixed = zone.buffs && zone.buffs.length >= 2;
    // 混合区：子区与主区同规格显示
    const subChips = isMixed ? zone.buffs.map(b => `<span class="zone-sub-chip">${b.name}</span>`).join('') : '';
    return `
        <div class="zone-card${isMixed ? ' zone-card-mixed' : ''}">
            <div class="zone-card-info">
                <div class="zone-name">${zone.name}${monsterTag ? ` <span class="zone-tag">${monsterTag}</span>` : ''}</div>
                ${subChips ? `<div class="zone-card-sub">${subChips}</div>` : ''}
            </div>
            <div class="zone-card-actions">
                <button class="zone-detail-btn" data-zone-index="${index}">详情</button>
            </div>
        </div>
    `;
}

// 渲染战区卡片
function renderZones(zones) {
    const container = document.getElementById('zonesContainer');
    let html = '';

    zones.forEach((zone, zi) => {
        html += createZoneCard(zone, zi);
    });

    container.innerHTML = html;

    // 绑定详情按钮
    container.querySelectorAll('.zone-detail-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const zi = parseInt(btn.dataset.zoneIndex);
            showZoneDetail(zi);
        });
    });
}

// 显示战区详情弹窗
function showZoneDetail(zoneIndex) {
    const zone = zonesData[zoneIndex];
    if (!zone) return;
    const modal = document.getElementById('zoneModal');
    const detail = document.getElementById('zoneDetail');

    const monsterTag = getMonsterTag(zone.description);
    let html = `
        <div class="zone-detail-header">
            <div class="zone-detail-name">${zone.name}${monsterTag ? ` <span class="zone-tag">${monsterTag}</span>` : ''}</div>
            <div class="zone-detail-desc">${zone.description}</div>
        </div>
    `;

    // 天气
    if (zone.weathers && zone.weathers.length > 0) {
        html += `<div class="boss-stage-section"><div class="boss-section-title">天气</div>`;
        zone.weathers.forEach(w => {
            html += `
                <div class="boss-buff">
                    <div class="boss-buff-name">${w.name}</div>
                    <div class="boss-buff-desc">${w.description}</div>
                </div>
            `;
        });
        html += '</div>';
    }

    // 增益
    if (zone.buffs && zone.buffs.length > 0) {
        html += `<div class="boss-stage-section"><div class="boss-section-title">增益</div>`;
        zone.buffs.forEach(b => {
            html += `
                <div class="boss-buff">
                    <div class="boss-buff-name">${b.name}</div>
                    <div class="boss-buff-desc">${b.description}</div>
                </div>
            `;
        });
        html += '</div>';
    }

    detail.innerHTML = html;
    modal.style.display = 'flex';
}

// 渲染排行榜
function getZoneScore(ranking, zoneId) {
    if (!ranking.zones) return 0;
    const zoneData = ranking.zones.find(z => z.id === zoneId);
    return zoneData ? (zoneData.score || 0) : 0;
}

function sortRankings(rankings, zones) {
    if (wzSortKey === null) return rankings;
    const sorted = [...rankings];
    sorted.sort((a, b) => {
        let va, vb;
        if (wzSortKey === 'total') {
            va = a.score || 0; vb = b.score || 0;
        } else {
            const zoneId = zones[parseInt(wzSortKey)]?.id;
            va = zoneId ? getZoneScore(a, zoneId) : 0;
            vb = zoneId ? getZoneScore(b, zoneId) : 0;
        }
        return wzSortAsc ? va - vb : vb - va;
    });
    return sorted;
}

function renderRankings(rankings, zones) {
    const container = document.getElementById('rankingTable');

    // 组合筛选：角色位筛选 + 搜索
    const filtered = rankings.filter(r => {
        if (wzSearchQuery && r.player) {
            const q = wzSearchQuery.toLowerCase();
            const nameMatch = (r.player.name || '').toLowerCase().includes(q);
            const idMatch = String(r.player.id).includes(wzSearchQuery);
            if (!nameMatch && !idMatch) return false;
        }
        if (!r.zones) return wzCharFilters.every(fz => fz.every(f => !f));
        return wzCharFilters.every((zoneFilters, zi) => {
            if (!zoneFilters) return true;
            return zoneFilters.every((filterVal, ci) => {
                if (!filterVal) return true;
                const zoneData = r.zones.find(z => z.id === zones[zi]?.id);
                const char = zoneData?.characters?.[ci];
                return char && char.rank === parseInt(filterVal);
            });
        });
    });
    const sorted = sortRankings(filtered, zones).slice(0, 100);

    // 各区阵容最高分对比（基于全量数据）
    const teamMax = computeTeamMaxScores(rawRankings, zones);

    // 该段位总分最高
    const totalMaxScore = rawRankings.reduce((m, r) => Math.max(m, r.score || 0), 0);

    // 排序指示器
    const arrow = (key) => {
        if (wzSortKey === key) return wzSortAsc ? ' ▲' : ' ▼';
        return ' ⇅';
    };

    // 动态生成表头（每区含3个角色位筛选下拉）
    let headerHtml = `
        <div class="ranking-header">
            <div class="col-rank">排名</div>
            <div class="col-player">玩家</div>
    `;
    zones.forEach((zone, i) => {
        headerHtml += `<div class="col-zone-detail"><div class="sortable" data-sort="${i}">${zone.name}<span class="sort-arrow">${arrow(String(i))}</span></div>`;
        if (!wzCharFilters[i]) wzCharFilters[i] = ['', '', ''];
        headerHtml += `<div class="char-slot-filters">`;
        for (let ci = 0; ci < 3; ci++) {
            const cur = wzCharFilters[i][ci] || '';
            headerHtml += `<select class="char-slot-select" data-zone="${i}" data-slot="${ci}"><option value="">-</option><option value="3"${cur==='3'?' selected':''}>S</option><option value="4"${cur==='4'?' selected':''}>SS</option><option value="5"${cur==='5'?' selected':''}>SSS</option><option value="6"${cur==='6'?' selected':''}>SSS+</option></select>`;
        }
        headerHtml += `</div>`;
        headerHtml += `<div class="zone-quick-filters"><button class="zone-quick-btn" data-zone="${i}" data-quick="sss">全SSS</button><button class="zone-quick-btn" data-zone="${i}" data-quick="sssp">全SSS+</button></div>`;
        headerHtml += `</div>`;
    });
    headerHtml += `
            <div class="col-total sortable" data-sort="total">总分<span class="sort-arrow">${arrow('total')}</span></div>
            <div class="col-reset"><button class="reset-filter-btn" id="wzFilterReset">重置</button></div>
        </div>
    `;

    let html = headerHtml;

    const total = sorted.length;
    sorted.forEach((ranking, idx) => {
        const displayRank = wzSortAsc ? total - idx : idx + 1;
        const rankClass = displayRank <= 3 ? `top-${displayRank}` : '';
        const rowClass = displayRank <= 3 ? ` top-${displayRank}-row` : '';
        const portraitUrl = ranking.player.portrait ? getImageUrl(ranking.player.portrait) : '';
        const frameUrl = ranking.player.frame ? getImageUrl(ranking.player.frame) : '';

        // 排名/分数变化
        let rankDeltaHtml = '';
        let scoreDeltaHtml = '';
        const delta = getRankDelta(ranking.player.id, ranking.rank, ranking.score);
        if (delta) {
            if (delta.rankDelta > 0) {
                rankDeltaHtml = `<span class="rank-delta-up">↑${delta.rankDelta}</span>`;
            } else if (delta.rankDelta < 0) {
                rankDeltaHtml = `<span class="rank-delta-down">↓${Math.abs(delta.rankDelta)}</span>`;
            } else {
                rankDeltaHtml = `<span class="rank-delta-same">—</span>`;
            }
            if (delta.scoreDelta > 0) {
                scoreDeltaHtml = `<span class="score-delta-up">+${formatScoreCompact(delta.scoreDelta)}</span>`;
            } else if (delta.scoreDelta < 0) {
                scoreDeltaHtml = `<span class="score-delta-down">-${formatScoreCompact(Math.abs(delta.scoreDelta))}</span>`;
            } else {
                scoreDeltaHtml = `<span class="score-delta-same">0</span>`;
            }
        }

        // 前三名奖牌样式
        const medalLabel = displayRank === 1 ? '冠军' : displayRank === 2 ? '亚军' : displayRank === 3 ? '季军' : '';
        const rankNumHtml = displayRank <= 3
            ? `<span class="rank-medal medal-${displayRank}">${displayRank}</span><span class="rank-medal-label">${medalLabel}</span>${rankDeltaHtml}`
            : `${displayRank}${rankDeltaHtml}`;

        html += `
            <div class="ranking-row${rowClass}">
                <div class="rank-num ${rankClass}">${rankNumHtml}</div>
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

        zones.forEach((zone, zi) => {
            const zoneData = ranking.zones ? ranking.zones.find(z => z.id === zone.id) : null;
            const score = zoneData ? formatNumber(zoneData.score) : '--';
            // 单区分数差值（仅当上期该区有分数才显示）
            let zoneDeltaHtml = '';
            if (delta && delta.zoneScores && zoneData && Object.prototype.hasOwnProperty.call(delta.zoneScores, zone.id)) {
                const prevZoneScore = delta.zoneScores[zone.id];
                const diff = (zoneData.score || 0) - prevZoneScore;
                if (diff > 0) zoneDeltaHtml = `<span class="score-delta-up">+${formatScoreCompact(diff)}</span>`;
                else if (diff < 0) zoneDeltaHtml = `<span class="score-delta-down">-${formatScoreCompact(Math.abs(diff))}</span>`;
                else zoneDeltaHtml = `<span class="score-delta-same">0</span>`;
            }
            // 阵容最高分对比（按阵容+阶级精确匹配）
            let teamCompareHtml = '';
            if (zoneData && zoneData.characters && zoneData.characters.length > 0) {
                const teamKey = getTeamKey(zoneData.characters);
                const max = teamMax[zone.id] && teamMax[zone.id][teamKey];
                const zscore = zoneData.score || 0;
                if (max && zscore > 0) {
                    const diff = max.score - zscore;
                    if (diff <= 0) {
                        teamCompareHtml = `<span class="zone-max-tag">同阶级阵容最高 ${formatNumber(max.score)}</span>`;
                    } else {
                        teamCompareHtml = `<span class="zone-diff-tag">同阶级阵容最高 ${formatNumber(max.score)} · 低${formatScoreCompact(diff)}</span>`;
                    }
                }
            }
            let charsHtml = '';
            if (zoneData && zoneData.characters) {
                zoneData.characters.forEach(c => {
                    const charIcon = c.icon ? getImageUrl(c.icon) : '';
                    const cubIcon = c.cubIcon ? getImageUrl(c.cubIcon) : '';
                    const qualityText = getQualityInfo(c.rank);
                    charsHtml += `
                        <div class="char-row">
                            <img class="char-icon-sm" src="${charIcon}" alt="" onerror="this.style.display='none'">
                            <span class="char-name-sm">${c.characterName}</span>
                            ${qualityText ? `<span class="rank-quality-sm quality-${c.rank}">${qualityText}</span>` : ''}
                            <span class="char-bp">${c.bp}</span>
                            <img class="cub-icon-sm" src="${cubIcon}" alt="" title="${c.cubName || ''}" onerror="this.style.display='none'">
                        </div>
                    `;
                });
            }
            html += `
                <div class="zone-detail">
                    <div class="zone-actions">
                        <button class="zone-sa-btn" data-player-id="${ranking.player.id}" data-zone-idx="${zi}">分析</button>
                        <button class="zone-sa-btn zone-trend-btn" data-player-id="${ranking.player.id}" data-zone-idx="${zi}" data-trend="1">趋势</button>
                    </div>
                    <div class="zone-name-sm">${zone.name}</div>
                    <div class="zone-score-val">${score}${zoneDeltaHtml}</div>
                    <div class="zone-team-compare">${teamCompareHtml}</div>
                    <div class="zone-chars">${charsHtml}</div>
                </div>
            `;
        });

        // 该段位总分最高标注
        const totalMaxTag = (ranking.score || 0) > 0 && (ranking.score || 0) >= totalMaxScore
            ? '<div class="total-max-tag">总分最高</div>'
            : '';

        html += `
                <div class="total-score">
                    <div>${formatNumber(ranking.score)}${scoreDeltaHtml}</div>
                    ${totalMaxTag}
                </div>
                <div class="col-reset"></div>
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

    // 各区分数分析按钮
    container.querySelectorAll('.zone-sa-btn:not([data-trend])').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const playerId = btn.dataset.playerId;
            const zi = parseInt(btn.dataset.zoneIdx);
            const ranking = rawRankings.find(r => String(r.player.id) === String(playerId));
            if (ranking) {
                renderZoneAnalysis(ranking, zi);
                document.getElementById('saModal').style.display = 'flex';
            }
        });
    });

    // 各区趋势按钮
    container.querySelectorAll('.zone-sa-btn[data-trend]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            renderPlayerCurveModal(btn.dataset.playerId, null, parseInt(btn.dataset.zoneIdx));
        });
    });

    // 各区角色位筛选变更
    container.querySelectorAll('.char-slot-select').forEach(select => {
        select.addEventListener('change', function() {
            const zi = parseInt(this.dataset.zone);
            const ci = parseInt(this.dataset.slot);
            if (!wzCharFilters[zi]) wzCharFilters[zi] = ['', '', ''];
            wzCharFilters[zi][ci] = this.value;
            renderRankings(rawRankings, zonesData);
        });
    });

    // 重置筛选
    const resetBtn = container.querySelector('#wzFilterReset');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            wzCharFilters = [];
            wzSearchQuery = '';
            const searchInput = document.getElementById('wzSearchInput');
            if (searchInput) searchInput.value = '';
            wzSortKey = null;
            wzSortAsc = false;
            renderRankings(rawRankings, zonesData);
        });
    }

    // 各区快速筛选：全SSS / 全SSS+
    container.querySelectorAll('.zone-quick-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const zi = parseInt(this.dataset.zone);
            const rankVal = this.dataset.quick === 'sss' ? '5' : '6';
            if (!wzCharFilters[zi]) wzCharFilters[zi] = ['', '', ''];
            wzCharFilters[zi] = [rankVal, rankVal, rankVal];
            renderRankings(rawRankings, zonesData);
        });
    });
}

// 记录本周各玩家三区分数曲线快照（仅本周，按难度+周隔离）
function recordWzCurve(difficulty, activity, rankings) {
    try {
        const key = `huaxu_wz_curve_${difficulty}_${activity}`;

        // 清理其它周（跨周自动清空）
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const k = localStorage.key(i);
            if (k && k.startsWith('huaxu_wz_curve_') && !k.endsWith(`_${activity}`)) {
                localStorage.removeItem(k);
            }
        }

        let data = null;
        try { data = JSON.parse(localStorage.getItem(key)); } catch { /* 忽略损坏数据 */ }
        if (!data || !data.samples) data = { samples: [] };

        const sample = { t: Date.now(), p: {} };
        (rankings || []).forEach(r => {
            sample.p[String(r.player.id)] = {
                n: r.player.name,
                z: (r.zones || []).map(z => z.score || 0),
                t: r.score || 0
            };
        });

        // 去重：与最近一次采样完全相同或间隔过短时不记录
        const last = data.samples[data.samples.length - 1];
        if (last) {
            if (Date.now() - last.t < 60 * 1000) return;
            if (JSON.stringify(last.p) === JSON.stringify(sample.p)) return;
        }

        data.samples.push(sample);
        if (data.samples.length > 200) data.samples = data.samples.slice(-200);
        localStorage.setItem(key, JSON.stringify(data));
    } catch { /* 存储失败忽略 */ }
}

// 读取某玩家本周曲线
function getPlayerCurve(playerId, difficulty, activity) {
    const key = `huaxu_wz_curve_${difficulty}_${activity}`;
    let data = null;
    try { data = JSON.parse(localStorage.getItem(key)); } catch { return []; }
    if (!data || !data.samples) return [];
    return data.samples.map(s => {
        const p = s.p[String(playerId)];
        return p ? { t: s.t, zones: p.z, total: p.t } : null;
    }).filter(Boolean);
}

// SVG 平滑折线图（按真实时间定位：startT~endT 为 x 轴范围）
let curveSvgId = 0;
function buildCurveSvgTimed(points, startT, endT) {
    const W = 640, H = 150, PAD = 10;
    const scores = points.map(p => p.score);
    let min = Math.min(...scores), max = Math.max(...scores);
    if (min === max) { min -= 100; max += 100; }
    const range = max - min;
    min -= range * 0.08;
    max += range * 0.08;
    const span = Math.max(endT - startT, 1);
    const x = t => PAD + (W - PAD * 2) * ((t - startT) / span);
    const y = s => H - PAD - (H - PAD * 2) * ((s - min) / (max - min));

    // Catmull-Rom 转贝塞尔平滑路径
    const pathD = () => {
        let d = `M${x(points[0].t).toFixed(1)},${y(points[0].score).toFixed(1)}`;
        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[Math.max(i - 1, 0)];
            const p1 = points[i];
            const p2 = points[i + 1];
            const p3 = points[Math.min(i + 2, points.length - 1)];
            const c1x = x(p1.t) + (x(p2.t) - x(p0.t)) / 6;
            const c1y = y(p1.score) + (y(p2.score) - y(p0.score)) / 6;
            const c2x = x(p2.t) - (x(p3.t) - x(p1.t)) / 6;
            const c2y = y(p2.score) - (y(p3.score) - y(p1.score)) / 6;
            d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${x(p2.t).toFixed(1)},${y(p2.score).toFixed(1)}`;
        }
        return d;
    };

    const lineD = pathD();
    const baseY = H - PAD;
    const areaD = `${lineD} L${x(points[points.length - 1].t).toFixed(1)},${baseY.toFixed(1)} L${x(points[0].t).toFixed(1)},${baseY.toFixed(1)} Z`;
    const gid = `curveGrad${curveSvgId++}`;

    const dots = points.map((p, i) =>
        `<circle cx="${x(p.t).toFixed(1)}" cy="${y(p.score).toFixed(1)}" r="3.5" class="curve-dot" data-curve-idx="${i}"></circle>`
    ).join('');
    const grid = [0.25, 0.5, 0.75].map(g => {
        const gy = H - PAD - (H - PAD * 2) * g;
        return `<line x1="${PAD}" y1="${gy.toFixed(1)}" x2="${W - PAD}" y2="${gy.toFixed(1)}" class="curve-grid"/>`;
    }).join('');
    const yLabels = [0.25, 0.5, 0.75].map(g => {
        const gy = H - PAD - (H - PAD * 2) * g;
        const bottomPct = ((H - gy) / H) * 100;
        const val = min + (max - min) * g;
        return `<span class="curve-ylabel" style="bottom:${bottomPct.toFixed(1)}%">${formatScoreCompact(val)}</span>`;
    }).join('');
    return `
        <div class="curve-plot">
            <svg class="curve-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
                <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.18"/>
                    <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
                </linearGradient></defs>
                ${grid}
                <line class="curve-guide" y1="0" y2="${H}"/>
                <path d="${areaD}" fill="url(#${gid})"/>
                <path d="${lineD}" class="curve-line"/>
                ${dots}
            </svg>
            <div class="curve-y-labels">${yLabels}</div>
            <div class="curve-tooltip"></div>
        </div>`;
}

// 悬浮 Tooltip：跟随鼠标，显示最近数据点的时间与分数
function initChartTooltip(chartEl, points, startT, endT) {
    const svg = chartEl.querySelector('.curve-svg');
    const guide = chartEl.querySelector('.curve-guide');
    const tooltip = chartEl.querySelector('.curve-tooltip');
    const dots = [...chartEl.querySelectorAll('.curve-dot')];
    const W = 640, PAD = 10;
    const span = Math.max(endT - startT, 1);

    svg.addEventListener('mousemove', (e) => {
        const rect = svg.getBoundingClientRect();
        const mx = ((e.clientX - rect.left) / rect.width) * W;
        const t = startT + ((mx - PAD) / (W - PAD * 2)) * span;
        let best = 0, bestDist = Infinity;
        points.forEach((p, i) => {
            const d = Math.abs(p.t - t);
            if (d < bestDist) { bestDist = d; best = i; }
        });
        const p = points[best];
        const gx = PAD + (W - PAD * 2) * ((p.t - startT) / span);
        guide.setAttribute('x1', gx.toFixed(1));
        guide.setAttribute('x2', gx.toFixed(1));
        guide.style.display = 'block';
        dots.forEach((d, i) => d.classList.toggle('curve-dot-hover', i === best));
        const px = (gx / W) * rect.width;
        tooltip.style.display = 'block';
        tooltip.style.left = `${Math.min(Math.max(px + 14, 4), Math.max(rect.width - 132, 4))}px`;
        tooltip.innerHTML = `<div class="curve-tip-time">${fmtDate(p.t)} ${fmtTime(p.t)}</div><div class="curve-tip-score">${formatNumber(p.score)}</div>`;
    });
    svg.addEventListener('mouseleave', () => {
        guide.style.display = 'none';
        tooltip.style.display = 'none';
        dots.forEach(d => d.classList.remove('curve-dot-hover'));
    });
}

function fmtTime(ts) {
    const d = new Date(ts);
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtDate(ts) {
    const d = new Date(ts);
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// 当前玩家曲线（弹窗内切换 区/今日/本周）
let curvePlayerId = null;
let curveZoneIndex = 0;
let curveTestMode = false;

// 生成模拟数据（用于预览图表效果：周一~周日完整数据，每天0:30~23:30每2小时采样，逐日上升）
function genTestSamples() {
    const samples = [];
    const now = new Date();
    const dayOfWeek = now.getDay() || 7;
    const dayBase = [118000, 121500, 125200, 128800, 132500, 136400, 140200];
    for (let d = 0; d < 7; d++) {
        const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (dayOfWeek - 1 - d));
        for (let h = 0; h <= 23; h += 2) {
            const t = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, 30).getTime();
            const s = dayBase[d] + Math.floor(Math.random() * 3000) + h * 45;
            samples.push({ t, zones: [s, s + 21000, s + 43000], total: s * 3 + 64000 });
        }
    }
    return samples;
}

function getCurveSamples() {
    if (curveTestMode) return genTestSamples();
    return getPlayerCurve(curvePlayerId, currentDifficulty, currentWeek);
}

function renderPlayerCurveModal(playerId, playerName, zoneIndex) {
    curvePlayerId = playerId;
    curveZoneIndex = zoneIndex || 0;
    if (!playerName) {
        const r = (rawRankings || []).find(x => String(x.player.id) === String(playerId));
        playerName = r ? r.player.name : playerId;
    }
    const difficultyLabel = (() => {
        const opt = document.querySelector(`#difficultySelect option[value="${currentDifficulty}"]`);
        return opt ? opt.textContent : currentDifficulty;
    })();
    document.getElementById('curveTitle').innerHTML =
        `${playerName} 本周走势 <span class="history-sub">${difficultyLabel} · 第${currentWeek}周</span>`;

    // 区Tab栏
    const zoneTabsEl = document.getElementById('curveZoneTabs');
    zoneTabsEl.innerHTML = (zonesData || []).map((z, i) =>
        `<button class="team-tab${i === curveZoneIndex ? ' active' : ''}" data-curve-zone-tab="${i}">${z.name}</button>`
    ).join('');
    zoneTabsEl.style.display = (zonesData && zonesData.length > 1) ? 'flex' : 'none';
    zoneTabsEl.querySelectorAll('[data-curve-zone-tab]').forEach(tab => {
        tab.addEventListener('click', () => {
            zoneTabsEl.querySelectorAll('[data-curve-zone-tab]').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            curveZoneIndex = parseInt(tab.dataset.curveZoneTab);
            const activeMode = document.querySelector('#curveTabs .team-tab.active');
            renderCurveContent(activeMode ? activeMode.dataset.curveTab : 'today');
        });
    });

    renderCurveContent('today');
    document.getElementById('curveModal').style.display = 'flex';
}

function renderCurveContent(mode) {
    const samples = getCurveSamples();
    const content = document.getElementById('curveContent');
    const zone = (zonesData || [])[curveZoneIndex];
    if (!zone) {
        content.innerHTML = '<div class="team-empty">暂无数据</div>';
        return;
    }

    // x 轴范围：今日 = 今天0点~24点；本周 = 周一0点~周日24点（按天聚合）
    const now = new Date();
    const day = now.getDay() || 7;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (day - 1)).getTime();
    let startT, endT, axisFn;
    if (mode === 'today') {
        startT = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        endT = startT + 24 * 3600 * 1000;
        axisFn = () => {
            const hours = [0, 4, 8, 12, 16, 20, 24];
            const pad = n => String(n).padStart(2, '0');
            return `<div class="curve-chart-axis curve-axis-7">${hours.map(h => `<span>${pad(h)}:00</span>`).join('')}</div>`;
        };
    } else {
        startT = monday;
        endT = monday + 7 * 24 * 3600 * 1000;
        axisFn = () => `<div class="curve-chart-axis curve-axis-7">${['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map(d => `<span>${d}</span>`).join('')}</div>`;
    }

    if (samples.length < 1) {
        content.innerHTML = '<div class="team-empty">本周暂未记录到数据。数据会随榜单每 30 分钟自动刷新时记录，刷新几次后再来看看。</div>';
        return;
    }

    const zi = curveZoneIndex;
    // 今日：仅当天采样点；本周：按天聚合（每天取最后一次采样作为该天数据点）
    let pts;
    if (mode === 'today') {
        pts = samples
            .map(s => ({ t: s.t, score: (s.zones && s.zones[zi]) || 0 }))
            .filter(p => p.score > 0 && p.t >= startT && p.t < endT);
    } else {
        const byDay = {};
        samples.forEach(s => {
            const d = new Date(s.t);
            const dayKey = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
            byDay[dayKey] = { t: s.t, score: (s.zones && s.zones[zi]) || 0 };
        });
        pts = Object.values(byDay).filter(p => p.score > 0).sort((a, b) => a.t - b.t);
    }
    const latest = pts.length ? formatNumber(pts[pts.length - 1].score) : '--';
    const first = pts.length ? formatNumber(pts[0].score) : '--';
    const diffHtml = (pts.length >= 2 && pts[0].score !== pts[pts.length - 1].score)
        ? ` <span class="${pts[pts.length - 1].score > pts[0].score ? 'score-delta-up' : 'score-delta-down'}">${pts[pts.length - 1].score > pts[0].score ? '+' : ''}${formatScoreCompact(pts[pts.length - 1].score - pts[0].score)}</span>`
        : '';
    const chartHtml = pts.length >= 2 ? buildCurveSvgTimed(pts, startT, endT) : '<div class="team-empty">该区暂无数据</div>';
    content.innerHTML = `
        <div class="curve-chart">
            <div class="curve-chart-title"><span>${zone.name}</span><span class="curve-range">${first} → ${latest}${diffHtml}</span></div>
            ${chartHtml}
            ${axisFn()}
        </div>`;
    if (pts.length >= 2) {
        initChartTooltip(content.querySelector('.curve-chart'), pts, startT, endT);
    }
}

// 排名变化快照：对比2小时前的榜单
function updateWzSnapshot(difficulty, activity, rankings) {
    const snapKey = `huaxu_wz_snap_${difficulty}`;
    let prev = null;
    try {
        const raw = localStorage.getItem(snapKey);
        if (raw) prev = JSON.parse(raw);
    } catch { /* 忽略损坏快照 */ }

    if (prev && prev.version === WZ_SNAPSHOT_VERSION && prev.activity === activity) {
        wzPrevSnapshot = prev;
    } else {
        wzPrevSnapshot = null;
    }

    // 基线超过30分钟（或无基线/旧格式）才更新存储，保持对比窗口
    const age = prev ? (Date.now() - (prev.timestamp || 0)) : Infinity;
    if (!prev || prev.version !== WZ_SNAPSHOT_VERSION || age >= WZ_SNAPSHOT_INTERVAL) {
        const snapshot = {
            version: WZ_SNAPSHOT_VERSION,
            challenge: difficulty,
            activity: activity,
            timestamp: Date.now(),
            entries: rankings
                .filter(r => r && r.player && r.score > 0) // 仅存有效分数
                .map(r => {
                    const zoneScores = {};
                    (r.zones || []).forEach(z => {
                        if (z && z.score > 0) zoneScores[z.id] = z.score;
                    });
                    return {
                        id: r.player.id,
                        rank: r.rank,
                        score: r.score,
                        zones: zoneScores
                    };
                })
        };
        try {
            localStorage.setItem(snapKey, JSON.stringify(snapshot));
        } catch { /* localStorage 满则忽略 */ }
    }
}

// 获取排名变化信息
function getRankDelta(playerId, currentRank, currentScore) {
    if (!wzPrevSnapshot) return null;
    const prev = wzPrevSnapshot.entries.find(e => String(e.id) === String(playerId));
    if (!prev || !(prev.score > 0)) return null; // 上期无有效分数则无基线
    return {
        rankDelta: prev.rank - currentRank,   // 正数=上升
        scoreDelta: (currentScore || 0) - prev.score,
        zoneScores: prev.zones || {}
    };
}

// ========== 阵容参考 ==========
// 阵容去重键：角色ID+阶级排序后拼接（位置互换视为同一阵容，同角色不同机体/不同阶级区分）
function getTeamKey(chars) {
    return chars.map(c => `${String(c.id || c.characterName)}-${c.rank || 0}`).sort().join('|');
}

// 阵容阶级标签：全同阶级显示"SSS+"，混搭显示"SSS+/SSS"
function getTeamRankLabel(chars) {
    if (!chars || chars.length === 0) return '';
    const ranks = chars.map(c => c.rank).filter(r => r > 0);
    if (ranks.length === 0) return '';
    const unique = [...new Set(ranks)];
    if (unique.length === 1) return getQualityInfo(unique[0]) || '';
    return unique.map(r => getQualityInfo(r)).join('/');
}

// 计算每区各阵容的最高分及归属玩家：map[区ID][阵容key] = { score, player }
function computeTeamMaxScores(rankings, zones) {
    const map = {};
    zones.forEach(z => { map[z.id] = {}; });
    (rankings || []).forEach(r => {
        if (!r.zones) return;
        r.zones.forEach(zd => {
            if (!zd || !zd.characters || zd.characters.length === 0) return;
            const key = getTeamKey(zd.characters);
            const score = zd.score || 0;
            if (!map[zd.id]) map[zd.id] = {};
            const cur = map[zd.id][key];
            if (!cur || score > cur.score) {
                map[zd.id][key] = {
                    score,
                    chars: zd.characters,
                    player: {
                        id: r.player.id,
                        name: r.player.name,
                        portrait: r.player.portrait,
                        frame: r.player.frame
                    }
                };
            }
        });
    });
    return map;
}

// 渲染阵容参考弹窗
function renderTeamModal(mode) {
    const content = document.getElementById('teamContent');
    const zoneTabsEl = document.getElementById('teamZoneTabs');
    if (!zonesData || zonesData.length === 0) {
        content.innerHTML = '<div class="team-empty">暂无数据</div>';
        zoneTabsEl.innerHTML = '';
        return;
    }

    // 区Tab栏
    let zoneTabsHtml = '';
    zonesData.forEach((zone, i) => {
        zoneTabsHtml += `<button class="team-tab${i === 0 ? ' active' : ''}" data-zone-tab="${i}">${zone.name}</button>`;
    });
    zoneTabsEl.innerHTML = zoneTabsHtml;
    zoneTabsEl.style.display = 'flex';

    renderTeamZone(0, mode);

    zoneTabsEl.querySelectorAll('.team-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            zoneTabsEl.querySelectorAll('.team-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            renderTeamZone(parseInt(tab.dataset.zoneTab), mode);
        });
    });
}

// 渲染某个区的阵容数据
function renderTeamZone(zoneIndex, mode) {
    const content = document.getElementById('teamContent');
    const zone = zonesData[zoneIndex];
    if (!zone) {
        content.innerHTML = '<div class="team-empty">暂无数据</div>';
        return;
    }
    content.innerHTML = `<div class="team-zone-block"><div class="team-zone-title">${zone.name}</div>`;
    if (mode === 'strong') {
        content.innerHTML += renderStrongTeams(zone.id);
    } else {
        content.innerHTML += renderCommonTeams(zone.id);
    }
    content.innerHTML += '</div>';
}

// ========== 阵容排行 ==========
// 每个阵容的玩家分数排名（按阵容去重，含阶级；折叠式展示，展开显示全部玩家）
function renderRankingModal() {
    const zoneTabsEl = document.getElementById('rankingZoneTabs');
    const content = document.getElementById('rankingContent');
    if (!zonesData || zonesData.length === 0) {
        content.innerHTML = '<div class="team-empty">暂无数据</div>';
        zoneTabsEl.innerHTML = '';
        return;
    }

    let zoneTabsHtml = '';
    zonesData.forEach((zone, i) => {
        zoneTabsHtml += `<button class="team-tab${i === 0 ? ' active' : ''}" data-ranking-zone-tab="${i}">${zone.name}</button>`;
    });
    zoneTabsEl.innerHTML = zoneTabsHtml;
    zoneTabsEl.style.display = 'flex';

    const searchInput = document.getElementById('rankingSearchInput');
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
    renderRankingZone(0, query);

    zoneTabsEl.querySelectorAll('[data-ranking-zone-tab]').forEach(tab => {
        tab.addEventListener('click', () => {
            zoneTabsEl.querySelectorAll('[data-ranking-zone-tab]').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const q = document.getElementById('rankingSearchInput').value.trim().toLowerCase();
            renderRankingZone(parseInt(tab.dataset.rankingZoneTab), q);
        });
    });
}

function renderRankingZone(zoneIndex, query) {
    const content = document.getElementById('rankingContent');
    const zone = zonesData[zoneIndex];
    if (!zone) {
        content.innerHTML = '<div class="team-empty">暂无数据</div>';
        return;
    }

    const groups = {};
    rawRankings.forEach(r => {
        if (!r.zones) return;
        const zd = r.zones.find(z => z.id === zone.id);
        if (!zd || !zd.characters || zd.characters.length === 0) return;
        const key = getTeamKey(zd.characters);
        if (!groups[key]) groups[key] = { chars: zd.characters, players: [] };
        groups[key].players.push({
            name: r.player.name,
            id: r.player.id,
            portrait: r.player.portrait,
            score: zd.score || 0
        });
    });

    let teams = Object.values(groups).filter(t => t.players.length > 0);
    if (query) {
        teams = teams.filter(t => t.chars.some(c => (c.characterName || '').toLowerCase().includes(query)));
    }
    if (teams.length === 0) {
        content.innerHTML = `<div class="team-zone-block"><div class="team-zone-title">${zone.name}</div><div class="team-empty">暂无数据</div></div>`;
        return;
    }

    teams.forEach(t => t.players.sort((a, b) => b.score - a.score));
    teams.sort((a, b) => b.players.length - a.players.length || b.players[0].score - a.players[0].score);

    const html = `<div class="team-zone-block"><div class="team-zone-title">${zone.name} · 共 ${teams.length} 套阵容</div>${teams.map((t, idx) => {
        const rankLabel = getTeamRankLabel(t.chars);
        const list = t.players.map((p, i) => {
            const posClass = i === 0 ? ' team-rank-pos-top1' : i === 1 ? ' team-rank-pos-top2' : i === 2 ? ' team-rank-pos-top3' : '';
            const avatar = p.portrait ? `<img class="team-rank-avatar" src="${getImageUrl(p.portrait)}" onerror="this.style.display='none'">` : '';
            return `
                <div class="team-rank-item" data-player-id="${p.id}">
                    <span class="team-rank-pos${posClass}">${i + 1}</span>
                    ${avatar}
                    <span class="team-rank-name">${p.name}</span>
                    <span class="team-rank-score">${formatNumber(p.score)}</span>
                </div>`;
        }).join('');
        return `
            <div class="team-rank-card">
                <div class="team-rank-card-header" data-rank-target="${idx}">
                    <span class="team-rank-toggle">▸</span>
                    <div class="team-rank-chars-sm">
                        ${t.chars.map(c => `<div class="team-rank-char-sm"><img src="${c.icon ? getImageUrl(c.icon) : ''}" alt="" title="${c.characterName}" onerror="this.style.display='none'"><em class="rank-quality-sm quality-${c.rank}">${getQualityInfo(c.rank)}</em></div>`).join('')}
                    </div>
                    <span class="team-rank-label">${rankLabel || '阶级未知'}</span>
                    <span class="team-rank-count">${t.players.length}人</span>
                    <span class="team-rank-max">最高 ${formatNumber(t.players[0].score)}</span>
                </div>
                <div class="team-rank-body" style="display: none;">${list}</div>
            </div>`;
    }).join('')}</div>`;

    content.innerHTML = html;

    content.querySelectorAll('.team-rank-card-header').forEach(header => {
        header.addEventListener('click', () => {
            const body = header.nextElementSibling;
            const toggle = header.querySelector('.team-rank-toggle');
            const open = body.style.display !== 'none';
            body.style.display = open ? 'none' : 'block';
            toggle.textContent = open ? '▸' : '▾';
            header.classList.toggle('open', !open);
        });
    });

    content.querySelectorAll('.team-rank-item').forEach(item => {
        item.addEventListener('click', () => {
            const id = item.dataset.playerId;
            if (id) {
                switchPage('player');
                loadPlayerData(id);
            }
        });
    });
}

// 最强阵容：该区得分最高的玩家所用阵容（按阵容去重，位置互换视为同一阵容）
function renderStrongTeams(zoneId) {
    const entries = rawRankings
        .map(r => ({ r, zd: r.zones ? r.zones.find(z => z.id === zoneId) : null }))
        .filter(x => x.zd && x.zd.characters && x.zd.characters.length > 0);

    if (entries.length === 0) return '<div class="team-empty">暂无数据</div>';

    entries.sort((a, b) => (b.zd.score || 0) - (a.zd.score || 0));

    // 按阵容去重（角色名排序），取分数最高的前3套
    const seen = new Set();
    const topTeams = [];
    for (const { r, zd } of entries) {
        const key = getTeamKey(zd.characters);
        if (seen.has(key)) continue;
        seen.add(key);
        topTeams.push({ chars: zd.characters, score: zd.score, playerName: r.player.name, playerId: r.player.id });
        if (topTeams.length >= 3) break;
    }

    if (topTeams.length === 0) return '<div class="team-empty">暂无数据</div>';

    return topTeams.map((t, i) => `
        <div class="team-card">
            <div class="team-rank-badge">NO.${i + 1}</div>
            <div class="team-chars">
                ${t.chars.map(c => {
                    const icon = c.icon ? getImageUrl(c.icon) : '';
                    return `<div class="team-char"><img src="${icon}" onerror="this.style.display='none'"><span>${c.characterName}</span><em class="rank-quality-sm quality-${c.rank}">${getQualityInfo(c.rank)}</em></div>`;
                }).join('')}
            </div>
            <div class="team-meta"><span class="team-score">${formatNumber(t.score)}分</span><span class="team-player">${t.playerName}</span></div>
        </div>
    `).join('');
}

// 最常用阵容：按出场次数占比统计（位置互换视为同一阵容）
function renderCommonTeams(zoneId) {
    const counts = {};
    let total = 0;
    rawRankings.forEach(r => {
        if (!r.zones) return;
        const zd = r.zones.find(z => z.id === zoneId);
        if (!zd || !zd.characters || zd.characters.length === 0) return;
        const key = getTeamKey(zd.characters);
        if (!counts[key]) counts[key] = { chars: zd.characters, count: 0 };
        counts[key].count++;
        total++;
    });

    const sorted = Object.values(counts).sort((a, b) => b.count - a.count);
    if (sorted.length === 0 || total === 0) return '<div class="team-empty">暂无数据</div>';

    const maxCount = sorted[0].count;
    return sorted.slice(0, 5).map((t, i) => {
        const pct = (t.count / total) * 100;
        return `
            <div class="team-card team-card-common">
                <div class="team-usage-bar"><div class="team-usage-fill" style="width:${Math.max((t.count / maxCount) * 100, 5)}%"></div></div>
                <div class="team-chars">
                    ${t.chars.map(c => {
                        const icon = c.icon ? getImageUrl(c.icon) : '';
                        return `<div class="team-char"><img src="${icon}" onerror="this.style.display='none'"><span>${c.characterName}</span></div>`;
                    }).join('')}
                </div>
                <div class="team-meta"><span class="team-usage-pct">${pct.toFixed(1)}%</span><span class="team-count">${t.count}人</span></div>
            </div>
        `;
    }).join('');
}

// ========== 玩家历史战绩 ==========
let historyCancelled = null;

async function loadPlayerHistory(playerId) {
    const modal = document.getElementById('historyModal');
    const progressEl = document.getElementById('historyProgress');
    const contentEl = document.getElementById('historyContent');
    const subEl = document.getElementById('historySub');

    if (!maxWeek || !minWeek) {
        alert('请先加载战区数据');
        return;
    }

    historyCancelled = false;
    modal.style.display = 'flex';
    subEl.textContent = `(第${currentDifficulty}段位)`;
    progressEl.innerHTML = '<div class="history-loading">正在查询历史战绩...</div>';
    contentEl.innerHTML = '';
    progressEl.style.display = 'block';

    const results = [];
    // 从最新往前查，最多查100周防止请求过多
    const startWeek = maxWeek;
    const endWeek = Math.max(minWeek, maxWeek - 99);

    let idx = 0;
    for (let week = startWeek; week >= endWeek; week--) {
        if (historyCancelled) break;
        idx++;
        progressEl.innerHTML = `<div class="history-loading">查询中... 第${idx}周 (${week})</div>`;
        try {
            const url = `${API_CONFIG.warzone}/${week}/${currentDifficulty}`;
            const resp = await fetchWithHeaders(url);
            const result = await resp.json();
            if (result.status === 'success' && result.data && result.data.rankings) {
                const found = result.data.rankings.find(r => String(r.player.id) === String(playerId));
                if (found) {
                    results.push({
                        week,
                        rank: found.rank,
                        score: found.score || 0
                    });
                }
            }
        } catch { /* 该周查询失败则跳过 */ }
        // 限速，避免请求过快
        await new Promise(r => setTimeout(r, 120));
    }

    progressEl.style.display = 'none';
    if (historyCancelled) {
        contentEl.innerHTML = '<div class="history-empty">查询已取消</div>';
        return;
    }

    if (results.length === 0) {
        contentEl.innerHTML = '<div class="history-empty">未找到该玩家在近100周该段位的上榜记录（仅统计进入TOP100的周）</div>';
        return;
    }

    results.sort((a, b) => a.week - b.week);
    let html = `<div class="history-summary">共找到 <b>${results.length}</b> 周上榜记录</div>`;
    html += '<table class="score-table history-table"><thead><tr><th>周次</th><th>排名</th><th>总分</th></tr></thead><tbody>';
    results.forEach(r => {
        const rankClass = r.rank <= 3 ? 'top-' + r.rank : '';
        html += `<tr><td>第${r.week}周</td><td><span class="${rankClass}" style="font-weight:700">${r.rank}</span></td><td>${formatNumber(r.score)}</td></tr>`;
    });
    html += '</tbody></table>';
    contentEl.innerHTML = html;
}

// 渲染分析弹窗中的角色（图标+名字+品质+战力）
function renderSaChar(c) {
    const icon = c.icon ? getImageUrl(c.icon) : '';
    const bp = c.bp ? `<span class="sa-char-bp">战力 ${formatNumber(c.bp)}</span>` : '';
    return `<div class="sa-char"><img src="${icon}" onerror="this.style.display='none'"><span>${c.characterName}</span><em class="rank-quality-sm quality-${c.rank}">${getQualityInfo(c.rank)}</em>${bp}</div>`;
}

// 渲染单区分数分析弹窗（某玩家某区的分与同阵容最高分关系）
function renderZoneAnalysis(ranking, zoneIndex) {
    const content = document.getElementById('saContent');
    const zone = zonesData[zoneIndex];
    if (!zone) return;
    const teamMax = computeTeamMaxScores(rawRankings, zonesData);

    const zoneData = ranking.zones ? ranking.zones.find(z => z.id === zone.id) : null;
    const monsterTag = getMonsterTag(zone.description);
    const zscore = zoneData ? (zoneData.score || 0) : 0;

    let html = `
        <div class="sa-header">
            <div class="sa-player-name">${ranking.player.name} <span class="sa-zone-label">${zone.name}${monsterTag ? ` <span class="zone-tag">${monsterTag}</span>` : ''}</span></div>
            <div class="sa-player-meta">ID: ${ranking.player.id} · 排名第${ranking.rank} · 总分 ${formatNumber(ranking.score)}</div>
        </div>
    `;

    if (!zoneData || !zoneData.characters || zoneData.characters.length === 0) {
        html += '<div class="sa-empty">该玩家此区无上榜数据</div>';
        content.innerHTML = html;
        return;
    }

    // 玩家该区分数
    html += `
        <div class="sa-zone">
            <div class="sa-zone-title">我的分数 <span class="sa-zone-score">${formatNumber(zscore)}分</span></div>
            <div class="sa-team">
                ${zoneData.characters.map(c => renderSaChar(c)).join('')}
            </div>
        </div>
    `;

    // 同阵容同阶级最高分对比
    const teamKey = getTeamKey(zoneData.characters);
    const max = teamMax[zone.id] && teamMax[zone.id][teamKey];
    if (max && max.score > 0) {
        const diff = max.score - zscore;
        const maxPortrait = max.player.portrait ? getImageUrl(max.player.portrait) : '';
        const relation = diff <= 0
            ? '<span class="zone-max-tag">您是该阵容最高分</span>'
            : `<span class="zone-diff-tag">低于最高分 ${formatScoreCompact(diff)}</span>`;

        // 最高分玩家的阵容
        const maxTeamHtml = max.chars && max.chars.length > 0
            ? `<div class="sa-team">
                ${max.chars.map(c => renderSaChar(c)).join('')}
               </div>`
            : '';

        html += `
            <div class="sa-zone">
                <div class="sa-zone-title">同阶级阵容最高分 <span class="sa-zone-score">${formatNumber(max.score)}分</span></div>
                <div class="sa-max-player">
                    <div class="sa-max-avatar"><img src="${maxPortrait}" onerror="this.style.display='none'"></div>
                    <div class="sa-max-info">
                        <div class="sa-max-name">${max.player.name}</div>
                        <div class="sa-max-id">ID: ${max.player.id}</div>
                    </div>
                </div>
                ${maxTeamHtml}
                <div class="sa-zone-compare" style="margin-top:10px;">${relation}</div>
            </div>
        `;
    } else {
        html += '<div class="sa-empty">暂无同阵容其他玩家数据</div>';
    }

    content.innerHTML = html;
}

// 渲染分数分布弹窗（总分 + 各区）
function renderBracketModal() {
    const tabsEl = document.getElementById('bracketTabs');
    const contentEl = document.getElementById('bracketContent');
    const subEl = document.getElementById('bracketSub');

    subEl.textContent = `(第${currentDifficulty}段位)`;

    // Tab栏：总分 + 各区
    let tabsHtml = '<button class="team-tab active" data-br="total">总分</button>';
    zonesData.forEach((zone, i) => {
        tabsHtml += `<button class="team-tab" data-br="${i}">${zone.name}</button>`;
    });
    tabsEl.innerHTML = tabsHtml;
    renderBracketContent('total');

    tabsEl.querySelectorAll('.team-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            tabsEl.querySelectorAll('.team-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            renderBracketContent(tab.dataset.br);
        });
    });
}

function renderBracketContent(key) {
    const contentEl = document.getElementById('bracketContent');
    let scores;
    if (key === 'total') {
        scores = rawRankings.map(r => r.score || 0).filter(s => s > 0);
    } else {
        const zoneId = zonesData[parseInt(key)]?.id;
        scores = rawRankings
            .map(r => r.zones ? (r.zones.find(z => z.id === zoneId) || {}).score : 0)
            .filter(s => s > 0);
    }

    if (scores.length === 0) {
        contentEl.innerHTML = '<div class="bracket-empty">暂无数据</div>';
        return;
    }

    const max = Math.max(...scores);
    const min = Math.min(...scores);
    const bucketCount = 10;
    const step = Math.ceil((max - min) / bucketCount / 1000000) * 1000000 || 1000000;
    const buckets = [];
    for (let s = min; s <= max; s += step) {
        const count = scores.filter(sc => sc >= s && sc < s + step).length;
        if (count > 0) buckets.push({ from: s, to: s + step, count });
    }
    const maxCount = Math.max(...buckets.map(b => b.count));

    let html = '<div class="bracket-title">' + (key === 'total' ? '总分' : zonesData[parseInt(key)]?.name || '') + '分布（' + formatNumber(scores.length) + ' 人）</div>';
    html += '<div class="bracket-list">';
    buckets.forEach(b => {
        const pct = Math.round((b.count / maxCount) * 100);
        const label = formatNumber(b.from) + ' - ' + formatNumber(b.to);
        html += `
            <div class="bracket-row">
                <div class="bracket-label">${label}</div>
                <div class="bracket-bar-wrap"><div class="bracket-bar" style="width:${Math.max(pct, 3)}%"></div></div>
                <div class="bracket-count">${b.count}</div>
            </div>
        `;
    });
    html += '</div>';
    contentEl.innerHTML = html;
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
// 各区角色位筛选：wzCharFilters[区索引][角色位索引] = '' | '3' | '4' | '5' | '6'
let wzCharFilters = [];
// 榜单搜索关键词
let wzSearchQuery = '';
// 排名变化对比基线
let wzPrevSnapshot = null;
const WZ_SNAPSHOT_INTERVAL = 30 * 60 * 1000; // 30分钟基线
const WZ_SNAPSHOT_VERSION = 3;
// 是否在浏览历史周（自动刷新仅刷新本周）
let wzViewingHistorical = false;

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
        const isCurrentWeek = currentWeek === null;
        const weekPath = isCurrentWeek ? 'current' : currentWeek;
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
                // 排名变化快照对比（仅本周数据参与对比，历史周不显示差值）
                if (isCurrentWeek) {
                    updateWzSnapshot(currentDifficulty, warzone.activity, rankings);
                    recordWzCurve(currentDifficulty, warzone.activity, rankings);
                } else {
                    wzPrevSnapshot = null;
                }
                rawRankings = rankings;
                wzSortKey = null;
                wzSortAsc = false;
                wzCharFilters = [];
                renderRankings(rankings, zonesData);
            }

            // 同步难度选择器
            document.getElementById('difficultySelect').value = currentDifficulty;
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
    document.getElementById('historyBtn').onclick = () => {
        loadPlayerHistory(player.id);
    };
    document.getElementById('curveBtn').onclick = () => {
        renderPlayerCurveModal(player.id, player.name);
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

    // 阵容参考弹窗
    const teamModal = document.getElementById('teamModal');
    document.getElementById('teamModalClose').addEventListener('click', () => {
        teamModal.style.display = 'none';
    });
    teamModal.addEventListener('click', (e) => {
        if (e.target === teamModal) teamModal.style.display = 'none';
    });
    // 模式Tab（最强/最常用）- 仅绑定带 data-tab 的
    teamModal.querySelectorAll('.team-tab[data-tab]').forEach(tab => {
        tab.addEventListener('click', () => {
            teamModal.querySelectorAll('.team-tab[data-tab]').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            renderTeamModal(tab.dataset.tab);
        });
    });

    // 分数分布弹窗
    const bracketModal = document.getElementById('bracketModal');
    document.getElementById('bracketModalClose').addEventListener('click', () => {
        bracketModal.style.display = 'none';
    });
    bracketModal.addEventListener('click', (e) => {
        if (e.target === bracketModal) bracketModal.style.display = 'none';
    });

    // 阵容排行弹窗
    const rankingModal = document.getElementById('rankingModal');
    document.getElementById('rankingModalClose').addEventListener('click', () => {
        rankingModal.style.display = 'none';
    });
    rankingModal.addEventListener('click', (e) => {
        if (e.target === rankingModal) rankingModal.style.display = 'none';
    });

    // 阵容排行搜索
    const rankingSearchInput = document.getElementById('rankingSearchInput');
    if (rankingSearchInput) {
        rankingSearchInput.addEventListener('input', () => {
            const activeTab = document.querySelector('#rankingZoneTabs .team-tab.active');
            const zi = activeTab ? parseInt(activeTab.dataset.rankingZoneTab) : 0;
            renderRankingZone(zi, rankingSearchInput.value.trim().toLowerCase());
        });
    }

    // 战区详情弹窗
    const zoneModal = document.getElementById('zoneModal');
    document.getElementById('zoneModalClose').addEventListener('click', () => {
        zoneModal.style.display = 'none';
    });
    zoneModal.addEventListener('click', (e) => {
        if (e.target === zoneModal) zoneModal.style.display = 'none';
    });

    // 历史战绩弹窗
    const historyModal = document.getElementById('historyModal');
    document.getElementById('historyModalClose').addEventListener('click', () => {
        historyModal.style.display = 'none';
        if (historyCancelled !== null) historyCancelled = true;
    });
    historyModal.addEventListener('click', (e) => {
        if (e.target === historyModal) {
            historyModal.style.display = 'none';
            if (historyCancelled !== null) historyCancelled = true;
        }
    });

    // 玩家本周走势弹窗
    const curveModal = document.getElementById('curveModal');
    document.getElementById('curveModalClose').addEventListener('click', () => {
        curveModal.style.display = 'none';
    });
    curveModal.addEventListener('click', (e) => {
        if (e.target === curveModal) curveModal.style.display = 'none';
    });
    curveModal.querySelectorAll('#curveTabs .team-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            curveModal.querySelectorAll('#curveTabs .team-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            renderCurveContent(tab.dataset.curveTab);
        });
    });

    // 分数分析弹窗
    const saModal = document.getElementById('saModal');
    document.getElementById('saModalClose').addEventListener('click', () => {
        saModal.style.display = 'none';
    });
    saModal.addEventListener('click', (e) => {
        if (e.target === saModal) saModal.style.display = 'none';
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
        sorted.sort((a, b) => {
            const sa = a.score || 0;
            const sb = b.score || 0;
            return ppcSortAsc ? sa - sb : sb - sa;
        });
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

async function saveWzScore() {
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
    const ok = await AUTH.syncToCloud('wz_scores', allScores);
    if (AUTH.isLoggedIn() && !ok) {
        alert('分数已保存到本地，但云端同步失败，请检查网络');
    }
}

async function savePpcScore() {
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
    const ok = await AUTH.syncToCloud('ppc_scores', allScores);
    if (AUTH.isLoggedIn() && !ok) {
        alert('分数已保存到本地，但云端同步失败，请检查网络');
    }
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
        wzViewingHistorical = parseInt(e.target.value) !== maxWeek;
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
            wzViewingHistorical = false;
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

    // 榜单搜索
    const wzSearchInput = document.getElementById('wzSearchInput');
    wzSearchInput.addEventListener('input', () => {
        wzSearchQuery = wzSearchInput.value.trim();
        renderRankings(rawRankings, zonesData);
    });

    // 分数分布弹窗
    document.getElementById('wzBracketBtn').addEventListener('click', () => {
        renderBracketModal();
        document.getElementById('bracketModal').style.display = 'flex';
    });

    // 阵容参考
    document.getElementById('wzTeamBtn').addEventListener('click', () => {
        renderTeamModal('strong');
        document.getElementById('teamModal').style.display = 'flex';
    });

    // 阵容排行
    document.getElementById('wzRankingBtn').addEventListener('click', () => {
        renderRankingModal();
        document.getElementById('rankingModal').style.display = 'flex';
    });

    // 测试数据开关（预览图表）
    const wzTestBtn = document.getElementById('wzTestBtn');
    if (wzTestBtn) {
        wzTestBtn.addEventListener('click', () => {
            curveTestMode = !curveTestMode;
            wzTestBtn.textContent = curveTestMode ? '真实数据' : '测试数据';
            wzTestBtn.classList.toggle('bracket-btn-active', curveTestMode);
        });
    }

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

    document.getElementById('saveWzBtn').addEventListener('click', async () => {
        await saveWzScore();
        alert('战区分数已保存');
    });

    document.getElementById('savePpcBtn').addEventListener('click', async () => {
        await savePpcScore();
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
                renderWzHistory();
                renderPpcHistory();
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

    // 每30分钟自动刷新本周榜单，对比排名变化（浏览历史周时跳过）
    setInterval(() => {
        if (!wzViewingHistorical) {
            currentWeek = null;
            currentPpcWeek = null;
            loadWarzoneData();
            loadPpcData();
        }
    }, 30 * 60 * 1000);

    // 恢复上次浏览的页面
    const savedPage = localStorage.getItem('currentPage');
    if (savedPage && document.getElementById(`${savedPage}Page`)) {
        switchPage(savedPage);
        if (savedPage === 'mine') renderMinePage();
    }

});

