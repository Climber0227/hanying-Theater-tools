// 库街区 API 前端直连封装（CORS 已验证开放，无需后端代理）
// 参考 PGRUID / XutheringWavesUID 的开源实现：请求头无签名，浏览器直连即可
// 发码: POST /user/getSmsCodeForH5（需极验滑块结果）
// 登录: POST /user/sdkLoginForH5（手机号+验证码 → token）
// 数据: POST /gamer/role/list、/haru/roleBox/{area,prisonerCage}

const KURO_BASE = 'https://api.kurobbs.com';
const PGR_GAME_ID = 2;
const KURO_TOKEN_KEY = 'kurobbs_token';
const KURO_PHONE_KEY = 'kurobbs_phone';

export function getKuroToken() {
    return localStorage.getItem(KURO_TOKEN_KEY) || '';
}
export function setKuroToken(token) {
    if (token) localStorage.setItem(KURO_TOKEN_KEY, token);
}
export function clearKuroToken() {
    localStorage.removeItem(KURO_TOKEN_KEY);
}
export function getKuroPhone() {
    return localStorage.getItem(KURO_PHONE_KEY) || '';
}
export function setKuroPhone(phone) {
    if (phone) localStorage.setItem(KURO_PHONE_KEY, phone);
}
export function clearKuroPhone() {
    localStorage.removeItem(KURO_PHONE_KEY);
}

function randomString(len) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let out = '';
    for (let i = 0; i < len; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
    return out;
}

// 通用 POST（form-urlencoded），返回 { code, msg, data }
async function kuroPost(path, { token, data, headers = {}, source = 'h5' } = {}) {
    const h = {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'source': source,
        'devcode': randomString(32),
        ...headers
    };
    if (token) h['token'] = token;
    const body = Object.entries(data || {})
        .filter(([, v]) => v != null)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');
    const resp = await fetch(`${KURO_BASE}${path}`, { method: 'POST', headers: h, body });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const result = await resp.json();
    if (typeof result !== 'object' || result === null) throw new Error('响应格式错误');
    return result;
}

function isOk(result) {
    return result.code === 0 || result.code === 200;
}

// 错误码 → 用户可读提示
export function kuroErrorText(result) {
    if (!result) return '请求失败';
    const msg = result.msg || '未知错误';
    if (result.code === 220) return '登录已过期，请重新绑定库街区';
    if (result.code === 270) return '当前网络环境存在风险，请切换网络（如 WiFi↔流量）后重试';
    if (result.code === 130) return '验证码错误，请重新输入';
    if (result.code === 132) return '验证码已过期，请重新获取';
    if (result.code === 1000) return '角色查询失败，请稍后再试';
    return msg;
}

// ===== 极验滑块 =====
// 加载 gt4.js（多源兜底），返回 Promise<initGeetest4>
function loadGeetest() {
    return new Promise((resolve, reject) => {
        if (window.initGeetest4) return resolve(window.initGeetest4);
        const srcs = [
            'https://static.geetest.com/v4/gt4.js',
            'https://static.geevisit.com/v4/gt4.js'
        ];
        let i = 0;
        const tryLoad = () => {
            if (i >= srcs.length) return reject(new Error('验证组件加载失败'));
            const s = document.createElement('script');
            s.src = srcs[i++];
            s.onload = () => (window.initGeetest4 ? resolve(window.initGeetest4) : tryLoad());
            s.onerror = tryLoad;
            document.head.appendChild(s);
        };
        tryLoad();
    });
}

// 弹出极验滑块，返回 geeTestData 字符串（需提交给发码接口）
export function showGeetestCaptcha() {
    return new Promise((resolve, reject) => {
        loadGeetest().then(init => {
            const captchaId = 'ec4aa4174277d822d73f2442a165a2cd';
            init({ captchaId, product: 'bind' }, captcha => {
                captcha.onSuccess(() => {
                    const result = captcha.getValidate();
                    if (!result) return reject(new Error('请完成验证'));
                    result.captcha_id = captchaId;
                    resolve(JSON.stringify(result));
                });
                captcha.onError(() => reject(new Error('验证服务出错，请重试')));
                captcha.showBox();
            });
        }).catch(reject);
    });
}

// ===== 发码 / 登录 =====

// 发送短信验证码（需先通过极验滑块）
export async function sendSmsCode(mobile, geeTestData) {
    const result = await kuroPost('/user/getSmsCodeForH5', {
        data: { mobile, geeTestData }
    });
    if (!isOk(result)) throw new Error(kuroErrorText(result));
    return result;
}

// 手机号+验证码登录，返回 token
export async function kuroLogin(mobile, code) {
    const devCode = randomString(32).toUpperCase();
    let result = await kuroPost('/user/sdkLoginForH5', {
        data: { mobile, code, devCode }
    });
    if (!isOk(result) && result.code !== 130 && result.code !== 132) {
        // 兜底尝试 sdkLogin（参数一致）
        const retry = await kuroPost('/user/sdkLogin', {
            data: { mobile, code, devCode }
        });
        if (isOk(retry)) result = retry;
    }
    if (!isOk(result)) throw new Error(kuroErrorText(result));
    const token = result.data && result.data.token;
    if (!token) throw new Error('登录成功但未返回 token');
    setKuroToken(token);
    return { token, data: result.data };
}

// ===== 角色与游戏数据 =====

// 账号角色列表（探测 serverId / roleId）
export async function getKuroRoleList(token) {
    const result = await kuroPost('/gamer/role/list', {
        token,
        data: { gameId: PGR_GAME_ID }
    });
    if (!isOk(result)) throw new Error(kuroErrorText(result));
    return Array.isArray(result.data) ? result.data : [];
}

async function gameRequest(path, token, roleId, serverId, extra = {}) {
    const result = await kuroPost(path, {
        token,
        data: { serverId, roleId, ...extra }
    });
    if (!isOk(result)) throw new Error(kuroErrorText(result));
    return result.data;
}

// 纷争战区数据
export async function getAreaData(token, roleId, serverId) {
    return gameRequest('/haru/roleBox/area', token, roleId, serverId);
}

// 刷新战双游戏数据（等同库街区App打开页面时的触发：服务器从游戏拉取最新数据）
// 同步前先调它，避免拿到服务器缓存的旧成绩
export async function refreshKuroData(token, roleId, serverId) {
    return gameRequest('/haru/roleBox/refreshData', token, roleId, serverId);
}

// 幻痛囚笼数据
export async function getPrisonerCageData(token, roleId, serverId) {
    return gameRequest('/haru/roleBox/prisonerCage', token, roleId, serverId);
}

// 角色列表（含战力 fightAbility，用于对比展示）
export async function getRoleIndexData(token, roleId, serverId) {
    return gameRequest('/haru/roleBox/roleIndex', token, roleId, serverId);
}
