// 用户认证模块
// 处理登录/注册/会话管理/云端数据同步

const AUTH_TOKEN_KEY = 'huaxu_auth_token';
const AUTH_PLAYER_ID_KEY = 'huaxu_auth_player_id';
const AUTH_PLAYER_NAME_KEY = 'huaxu_auth_player_name';

const AUTH = {
    token: null,
    playerId: null,
    playerName: null,
    _syncing: false,

    // 初始化：从 localStorage 恢复会话
    async init() {
        this.token = localStorage.getItem(AUTH_TOKEN_KEY);
        this.playerId = localStorage.getItem(AUTH_PLAYER_ID_KEY);
        this.playerName = localStorage.getItem(AUTH_PLAYER_NAME_KEY);

        if (this.token) {
            // 验证 token 是否仍然有效（静默验证，失败不影响使用）
            try {
                const resp = await fetch(USER_DATA_API, {
                    headers: { 'Authorization': `Bearer ${this.token}` }
                });
                if (resp.status === 401) {
                    this._clearLocal();
                }
            } catch {
                // 网络错误不清除 token，可能是暂时断网
            }
        }

        this._updateUI();
    },

    // 登录（首次自动注册）
    async login(playerId, password) {
        if (!playerId || !password) {
            throw new Error('请输入游戏ID和密码');
        }

        const resp = await fetch(AUTH_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'login', playerId, password })
        });

        const result = await resp.json();

        if (!resp.ok) {
            throw new Error(result.error || '登录失败');
        }

        // 保存会话信息
        this.token = result.data.token;
        this.playerId = result.data.playerId;
        this.playerName = result.data.playerName || '';

        localStorage.setItem(AUTH_TOKEN_KEY, this.token);
        localStorage.setItem(AUTH_PLAYER_ID_KEY, this.playerId);
        localStorage.setItem(AUTH_PLAYER_NAME_KEY, this.playerName);

        // 登录后从云端拉取数据同步到本地
        await this._pullFromCloud();

        this._updateUI();
        return result.data;
    },

    // 注册
    async register(playerId, password) {
        if (!playerId || !password) {
            throw new Error('请输入游戏ID和密码');
        }

        if (password.length < 4) {
            throw new Error('密码至少4个字符');
        }

        const resp = await fetch(AUTH_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'register', playerId, password })
        });

        const result = await resp.json();

        if (!resp.ok) {
            throw new Error(result.error || '注册失败');
        }

        this.token = result.data.token;
        this.playerId = result.data.playerId;
        this.playerName = result.data.playerName || '';

        localStorage.setItem(AUTH_TOKEN_KEY, this.token);
        localStorage.setItem(AUTH_PLAYER_ID_KEY, this.playerId);
        localStorage.setItem(AUTH_PLAYER_NAME_KEY, this.playerName);

        // 注册后把本地已有数据推送到云端
        await this._pushToCloud();

        this._updateUI();
        return result.data;
    },

    // 退出登录
    logout() {
        this._clearLocal();
        this._updateUI();
    },

    // 是否已登录
    isLoggedIn() {
        return !!this.token;
    },

    // 获取当前玩家ID
    getPlayerId() {
        return this.playerId;
    },

    // 清除本地会话信息
    _clearLocal() {
        this.token = null;
        this.playerId = null;
        this.playerName = null;
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem(AUTH_PLAYER_ID_KEY);
        localStorage.removeItem(AUTH_PLAYER_NAME_KEY);
    },

    // 从云端拉取数据到 localStorage
    async _pullFromCloud() {
        if (!this.token) return;

        try {
            const resp = await fetch(USER_DATA_API, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (!resp.ok) return;

            const result = await resp.json();
            if (result.status !== 'success' || !result.data) return;

            const cloudData = result.data;

            // 云端数据覆盖本地
            if (cloudData.bind) {
                localStorage.setItem(BIND_KEY, JSON.stringify(cloudData.bind));
            }
            if (cloudData.history) {
                localStorage.setItem(HISTORY_KEY, JSON.stringify(cloudData.history));
            }
            if (cloudData.follows) {
                localStorage.setItem(FOLLOW_KEY, JSON.stringify(cloudData.follows));
            }
            if (cloudData.wz_scores) {
                localStorage.setItem(WZ_SCORE_KEY, JSON.stringify(cloudData.wz_scores));
            }
            if (cloudData.ppc_scores) {
                localStorage.setItem(PPC_SCORE_KEY, JSON.stringify(cloudData.ppc_scores));
            }
        } catch (error) {
            console.error('从云端拉取数据失败:', error);
        }
    },

    // 把 localStorage 中的数据推送到云端
    async _pushToCloud() {
        if (!this.token) return;

        const keys = [
            { key: 'bind', storageKey: BIND_KEY },
            { key: 'history', storageKey: HISTORY_KEY },
            { key: 'follows', storageKey: FOLLOW_KEY },
            { key: 'wz_scores', storageKey: WZ_SCORE_KEY },
            { key: 'ppc_scores', storageKey: PPC_SCORE_KEY }
        ];

        for (const { key, storageKey } of keys) {
            try {
                const raw = localStorage.getItem(storageKey);
                if (!raw) continue;

                const data = JSON.parse(raw);
                await fetch(USER_DATA_API, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.token}`
                    },
                    body: JSON.stringify({ key, data })
                });
            } catch (error) {
                console.error(`推送 ${key} 到云端失败:`, error);
            }
        }
    },

    // 同步单条数据到云端（保存时调用）
    async syncToCloud(key, data) {
        if (!this.token) return;

        try {
            await fetch(USER_DATA_API, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ key, data })
            });
        } catch (error) {
            console.error(`同步 ${key} 到云端失败:`, error);
        }
    },

    // 从云端删除单条数据
    async deleteFromCloud(key) {
        if (!this.token) return;

        try {
            await fetch(USER_DATA_API, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ key })
            });
        } catch (error) {
            console.error(`删除云端 ${key} 失败:`, error);
        }
    },

    // 更新登录 UI
    _updateUI() {
        const loginSection = document.getElementById('loginSection');
        const loggedInSection = document.getElementById('loggedInSection');

        if (!loginSection || !loggedInSection) return;

        if (this.isLoggedIn()) {
            loginSection.style.display = 'none';
            loggedInSection.style.display = 'block';
            document.getElementById('loggedInName').textContent =
                this.playerName || `ID: ${this.playerId}`;
            document.getElementById('loggedInId').textContent = this.playerId;
        } else {
            loginSection.style.display = 'block';
            loggedInSection.style.display = 'none';
        }
    }
};
