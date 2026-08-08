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
    ppc_scores: 'my_ppc_scores',
    kuro_token: 'kurobbs_token',
    kuro_phone: 'kurobbs_phone'
};

// 纯字符串字段（非 JSON 结构），云端存取不做 JSON 包装
const STRING_KEYS = new Set(['kuro_token', 'kuro_phone']);

// 登录自动推送排除库街区绑定（绑定归属由主动绑定动作决定，防止换账号串号）
const PUSH_EXCLUDE = new Set(['kuro_token', 'kuro_phone']);

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
        if (!playerId || !password) throw new Error('请输入用户名和密码');
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
        if (!playerId || !password) throw new Error('请输入用户名和密码');
        if (!AUTH_API) throw new Error('本地开发环境不支持注册');
        if (!/^.{6,20}$/.test(password)) throw new Error('密码需为6-20位');
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

    // 找回密码 Step1：获取账号绑定的库街区手机号（脱敏）
    async getResetPhone(username) {
        if (!AUTH_API) throw new Error('本地开发环境不支持');
        const resp = await fetch(AUTH_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'reset_phone', username })
        });
        const result = await resp.json();
        if (!resp.ok) throw new Error(result.error || '请求失败');
        return result.data.phone;
    },

    // 找回密码：后端代发验证码（极验由浏览器完成，号码不经过前端）
    async sendResetCode(username, geeTestData) {
        if (!AUTH_API) throw new Error('本地开发环境不支持');
        const resp = await fetch(AUTH_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'send_reset_code', username, geeTestData })
        });
        const result = await resp.json();
        if (!resp.ok) throw new Error(result.error || '发送失败');
        return result;
    },

    // 找回密码 Step2：验证码验证 + 重置密码
    async resetPassword(username, code, newPassword) {
        if (!AUTH_API) throw new Error('本地开发环境不支持');
        const resp = await fetch(AUTH_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'reset', username, code, newPassword })
        });
        const result = await resp.json();
        if (!resp.ok) throw new Error(result.error || '重置失败');
        return result;
    },

    async logout() {
        const token = this.token;
        this._clearLocal();
        if (token && USER_DATA_API) {
            try {
                await fetch(AUTH_API, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'logout', token })
                });
            } catch { /* 服务端注销失败不阻断本地登出 */ }
        }
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
                    const v = result.data[cloudKey];
                    localStorage.setItem(storageKey, STRING_KEYS.has(cloudKey) ? v : JSON.stringify(v));
                    // 云端拉到的库街区绑定归属当前登录账号
                    if (cloudKey === 'kuro_token' && this.playerId) {
                        localStorage.setItem('kurobbs_bound_user', this.playerId);
                    }
                }
            });
        } catch { /* 忽略 */ }
    },

    async _pushToCloud() {
        if (!this.token || !USER_DATA_API) return;
        for (const [cloudKey, storageKey] of Object.entries(STORAGE_KEYS)) {
            if (PUSH_EXCLUDE.has(cloudKey)) continue; // 库街区绑定只在主动绑定时推送
            try {
                const raw = localStorage.getItem(storageKey);
                if (!raw) continue;
                const payload = STRING_KEYS.has(cloudKey) ? raw : JSON.parse(raw);
                await fetch(USER_DATA_API, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.token}`
                    },
                    body: JSON.stringify({ key: cloudKey, data: payload })
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
    },

    async removeCloud(key) {
        if (!this.token || !USER_DATA_API) return false;
        try {
            const resp = await fetch(USER_DATA_API, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ key })
            });
            return resp.ok;
        } catch {
            return false;
        }
    }
};
