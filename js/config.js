// 环境检测
const IS_WEB = !window.electronAPI;
const IS_LOCAL = IS_WEB && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

// API 地址直连（api.huaxu.app 已设置 Access-Control-Allow-Origin: *，无需代理）
const API_BASE = '';
const AUTH_API = IS_WEB && !IS_LOCAL ? '/api/auth' : '';
const USER_DATA_API = IS_WEB && !IS_LOCAL ? '/api/user-data' : '';

// API配置
const API_CONFIG = {
    // 战区数据API
    warzone: 'https://api.huaxu.app/servers/cn/warzone',

    // 玩家数据API
    player: 'https://api.huaxu.app/servers/cn/players',

    // 幻痛囚笼API
    ppc: 'https://api.huaxu.app/servers/cn/ppc',

    // 资源基础URL
    assets: 'https://assets.huaxu.app/cn'
};

// 图片资源路径
const IMAGE_PATHS = {
    // 角色相关
    rolecharacter: 'image/rolecharacter',        // 角色图标
    rolecharacterbig: 'image/rolecharacterbig',   // 角色大图
    roleplayersp: 'image/roleplayersp',          // 玩家头像
    rolepartner: 'image/rolepartner',            // 专武图标
    rolemonster: 'image/rolemonster',            // 怪物图标

    // UI图标
    iconaffix: 'image/iconaffix',                // 增益图标
    iconcoating: 'image/iconcoating',            // 涂装图标
    iconcurrency: 'image/iconcurrency',          // 货币图标
    iconskill: 'image/iconskill',                // 技能图标
    icontype: 'image/icontype',                  // 类型图标

    // 背景图片
    bgcg: 'image/bgcg',                          // CG图片
    bgstory: 'image/bgstory',                    // 剧情背景
    bgui: 'image/bgui',                          // UI背景

    // 其他
    arms: 'image/arms',                          // 武器图片
    pets: 'image/pets',                          // 宠物图片
    logo: 'image/logo'                           // Logo
};

// 音频资源路径
const AUDIO_PATHS = {
    // 角色语音（按角色名缩写）
    character: {
        lucia: 'audio/c_luciark3',               // 露西亚
        liv: 'audio/c_liv',                      // 丽芙
        bianka: 'audio/c_biancark2',             // 比安卡
        kamui: 'audio/c_kamuirk3',               // 卡穆
        karen: 'audio/c_karenrk3',               // 卡列尼娜
        hanying: 'audio/c_hanyingrk3',           // 含英
        // ... 更多角色
    },

    // 战斗音乐
    battle: {
        ev10: 'audio/m_ev10_battle',
        ev11: 'audio/m_ev11_boss_2',
        ev13: 'audio/m_ev13_boss',
        // ... 更多战斗音乐
    },

    // Boss音乐
    boss: {
        ev13: 'audio/m_ev13_boss',
        ev15: 'audio/m_ev15_boss_1',
        ev24: 'audio/m_ev24_boss_2',
        // ... 更多Boss音乐
    },

    // 环境音效
    ambient: {
        seawave: 'audio/g_amb_ev14_seawave',
        undersea: 'audio/g_amb_ev14_undersea',
        train: 'audio/g_amb_ev3_trainnm',
        // ... 更多环境音效
    },

    // 系统音乐
    system: {
        gacha: 'audio/m_ev37_gacha_main',
        newyear: 'audio/m_sys_newyear',
        // ... 更多系统音乐
    }
};

// 图集资源路径（UI相关）
const ATLAS_PATHS = {
    // 战斗相关
    arena: 'atlas/uiarena',                      // 战区UI
    arenanew: 'atlas/uiarenanew',                // 新战区UI
    arenaonline: 'atlas/uiarenaonline',          // 在线战区

    // 功能UI
    bag: 'atlas/uibag',                          // 背包
    gacha: 'atlas/uigacha',                      // 抽卡
    shop: 'atlas/uishop',                        // 商店
    task: 'atlas/uitask',                        // 任务

    // 主界面
    main: 'atlas/uimain',                        // 主界面
    login: 'atlas/uilogin',                      // 登录界面

    // 活动UI
    activity: 'atlas/uiactivitybase',            // 活动基础
    anniversary: 'atlas/uianniversarymain',      // 周年庆

    // 其他
    achievement: 'atlas/uiachievement',          // 成就
    archive: 'atlas/uiarchive',                  // 档案
    dorm: 'atlas/uidorm',                        // 宿舍
    guild: 'atlas/uiguild'                       // 公会
};

// 视频资源路径
const VIDEO_PATHS = {
    bigworld: 'video/bigworld'                   // 大世界视频
};

// 获取完整图片URL
function getImageUrl(path) {
    if (!path) return '';
    return `${API_CONFIG.assets}/${path}.png`;
}

// 获取完整音频URL
function getAudioUrl(path) {
    if (!path) return '';
    return `${API_CONFIG.assets}/${path}.mp3`;
}

// 获取完整图集URL
function getAtlasUrl(path) {
    if (!path) return '';
    return `${API_CONFIG.assets}/${path}.png`;
}

// 获取完整视频URL
function getVideoUrl(path) {
    if (!path) return '';
    return `${API_CONFIG.assets}/${path}.mp4`;
}

// 导出配置（如果需要模块化）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        IS_WEB,
        IS_LOCAL,
        API_BASE,
        AUTH_API,
        USER_DATA_API,
        API_CONFIG,
        IMAGE_PATHS,
        AUDIO_PATHS,
        ATLAS_PATHS,
        VIDEO_PATHS,
        getImageUrl,
        getAudioUrl,
        getAtlasUrl,
        getVideoUrl
    };
}
