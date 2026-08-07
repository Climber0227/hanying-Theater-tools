// 用户认证模块（迁移自 js/auth.js）
const AUTH_TOKEN_KEY = 'huaxu_auth_token';
const AUTH_PLAYER_ID_KEY = 'huaxu_auth_player_id';
const AUTH_PLAYER_NAME_KEY = 'huaxu_auth_player_name';

const IS_WEB = true;
const IS_LOCAL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const AUTH_API = IS_WEB && !IS_LOCAL ? '/api/auth' : '';
const USER_DATA_API = IS_WEB && !IS_LOCAL ? '/api/user-data' : '';

const STORAGE_KEYS = {
    bind: 'player_bind',
    history: 'player_search_history',
    follows: 'player_follows',
    wz_scores: 'my_wz_scores',
    ppc_scores: 'my_ppc_scores'
};

export const auth = {
    token: null,
    playerId: null,
    playerName: null,

    isLoggedIn() {
        return !!this.token;
    },

    async init() {
        this.token = localStorage.getItem(AUTH_TOKEN_KEY);
        this.playerId = localStorage.getItem(AUTH_PLAYER_ID_KEY);
        this.playerName = localStorage.getItem(AUTH_PLAYER_NAME_KEY);
        if (this.token && USER_DATA_API) {
            try {
                const resp = await fetch(USER_DATA_API, {
                    headers: { 'Authorization': `Bearer ${this.token}` }
                });
                if (resp.status === 401) {
                    this._clearLocal();
                } else if (resp.ok) {
                    await this._pullFromCloud();
                }
            } catch { /* 网络错误保留会话 */ }
        }
        return this;
    },

    async login(playerId, password) {
        if (!playerId || !password) throw new Error('请输入游戏ID和密码');
        if (!AUTH_API) throw new Error('本地开发环境不支持登录');
        const resp = await fetch(AUTH_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'login', playerId, password })
        });
        const result = await resp.json();
        if (!resp.ok) throw new Error(result.error || '登录失败');
        this._saveSession(result.data);
        await this._pullFromCloud();
        await this._pushToCloud();
        return result.data;
    },

    async register(playerId, password) {
        if (!playerId || !password) throw new Error('请输入游戏ID和密码');
        if (!AUTH_API) throw new Error('本地开发环境不支持注册');
        if (password.length < 4) throw new Error('密码至少4个字符');
        const resp = await fetch(AUTH_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'register', playerId, password })
        });
        const result = await resp.json();
        if (!resp.ok) throw new Error(result.error || '注册失败');
        this._saveSession(result.data);
        await this._pushToCloud();
        return result.data;
    },

    logout() {
        this._clearLocal();
    },

    _saveSession(data) {
        this.token = data.token;
        this.playerId = data.playerId;
        this.playerName = data.playerName || '';
        localStorage.setItem(AUTH_TOKEN_KEY, this.token);
        localStorage.setItem(AUTH_PLAYER_ID_KEY, this.playerId);
        localStorage.setItem(AUTH_PLAYER_NAME_KEY, this.playerName);
    },

    _clearLocal() {
        this.token = null;
        this.playerId = null;
        this.playerName = null;
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem(AUTH_PLAYER_ID_KEY);
        localStorage.removeItem(AUTH_PLAYER_NAME_KEY);
    },

    async _pullFromCloud() {
        if (!this.token || !USER_DATA_API) return;
        try {
            const resp = await fetch(USER_DATA_API, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (!resp.ok) return;
            const result = await resp.json();
            if (result.status !== 'success' || !result.data) return;
            Object.entries(STORAGE_KEYS).forEach(([cloudKey, storageKey]) => {
                if (result.data[cloudKey] != null) {
                    localStorage.setItem(storageKey, JSON.stringify(result.data[cloudKey]));
                }
            });
        } catch { /* 忽略 */ }
    },

    async _pushToCloud() {
        if (!this.token || !USER_DATA_API) return;
        for (const [cloudKey, storageKey] of Object.entries(STORAGE_KEYS)) {
            try {
                const raw = localStorage.getItem(storageKey);
                if (!raw) continue;
                await fetch(USER_DATA_API, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.token}`
                    },
                    body: JSON.stringify({ key: cloudKey, data: JSON.parse(raw) })
                });
            } catch { /* 忽略 */ }
        }
    },

    async syncToCloud(key, data) {
        if (!this.token || !USER_DATA_API) return false;
        try {
            const resp = await fetch(USER_DATA_API, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ key, data })
            });
            return resp.ok;
        } catch {
            return false;
        }
    }
};
