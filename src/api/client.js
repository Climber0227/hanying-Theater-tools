import { API_ORIGIN, apiUrl, apiUrlNoCache } from './config.js';

// 内存缓存：URL → { data, expire }，TTL 60s（与 CDN max-age=60 对齐）
// 目的：切难度/切周/页面跳转复用数据，减少对源站请求次数
const CACHE_TTL = 60 * 1000;
const CACHE_MAX = 48; // 上限，超出按插入顺序淘汰最旧的（避免长会话内存膨胀）
const cache = new Map();

// 同一 URL 的并发请求合并：StrictMode 双执行、快速连点切难度时只发一次
const inflight = new Map();

const DEFAULT_TIMEOUT = 10000; // 单次请求超时（源站偶发卡在 20s+，10s 就换一次重试更快）
const DEFAULT_RETRIES = 2; // 失败重试次数（共 3 次尝试）
const RETRY_BASE_DELAY = 400;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------- 代理可用性 ----------
// 源站（api.huaxu.app）在 Cloudflare 后面，数据中心 IP 会被挑战（403 + 验证页）。
// 所以同源代理只能「尽力而为」：一旦发现它返回 502/HTML，本次会话就改用直连，
// 30 分钟后再试一次。这样即便代理走不通，用户也只会多花一次快速失败的请求。
const PROXY_PREFIX = '/api/huaxu?';
const PROXY_BLOCK_KEY = 'huaxu_proxy_blocked_at';
const PROXY_RETRY_MS = 30 * 60 * 1000;

function isProxyUrl(url) {
    return typeof url === 'string' && url.startsWith(PROXY_PREFIX);
}

function isProxyDisabled() {
    try {
        const at = Number(sessionStorage.getItem(PROXY_BLOCK_KEY) || 0);
        return at > 0 && Date.now() - at < PROXY_RETRY_MS;
    } catch (e) {
        return false;
    }
}

function markProxyDisabled() {
    try {
        sessionStorage.setItem(PROXY_BLOCK_KEY, String(Date.now()));
    } catch (e) { /* 隐私模式下忽略 */ }
}

// 把 /api/huaxu?path=/servers/... 还原成直连源站的地址
function directUrlFor(proxyUrl) {
    try {
        const query = proxyUrl.slice(proxyUrl.indexOf('?') + 1);
        const params = new URLSearchParams(query);
        const path = params.get('path');
        if (!path) return null;
        const extra = params.get('q');
        return `${API_ORIGIN}${path}${extra ? `?${extra}` : ''}`;
    } catch (e) {
        return null;
    }
}

function cacheGet(url) {
    const hit = cache.get(url);
    if (!hit) return undefined;
    if (Date.now() >= hit.expire) {
        cache.delete(url);
        return undefined;
    }
    return hit.data;
}

function cacheSet(url, data) {
    cache.delete(url);
    cache.set(url, { data, expire: Date.now() + CACHE_TTL });
    while (cache.size > CACHE_MAX) {
        const oldest = cache.keys().next().value;
        if (oldest === undefined) break;
        cache.delete(oldest);
    }
}

const NETWORK_HINTS = /failed to fetch|networkerror|load failed|fetch failed|网络|ERR_/i;

// ---------- 持久层缓存（sessionStorage） ----------
// 目的：切回 10 分钟内看过的难度/周，直接用本地数据秒开，不再等一次往返。
// 只存战区榜单（玩家/幻痛等每次都该是新的），并且限制条数与单条体积，避免撑爆 sessionStorage。
const PERSIST_PREFIX = 'huaxu_wz_cache_v1:';
const PERSIST_INDEX = 'huaxu_wz_cache_index';
const PERSIST_TTL = 10 * 60 * 1000;
const PERSIST_MAX = 12;
const PERSIST_MAX_BYTES = 600 * 1000;

function persistGet(url) {
    try {
        const raw = sessionStorage.getItem(PERSIST_PREFIX + url);
        if (!raw) return null;
        const rec = JSON.parse(raw);
        if (!rec || !rec.ts || !rec.data) return null;
        if (Date.now() - rec.ts > PERSIST_TTL) {
            sessionStorage.removeItem(PERSIST_PREFIX + url);
            return null;
        }
        return rec;
    } catch (e) {
        return null;
    }
}

function persistSet(url, data) {
    try {
        const raw = JSON.stringify({ ts: Date.now(), data });
        if (raw.length > PERSIST_MAX_BYTES) return;
        sessionStorage.setItem(PERSIST_PREFIX + url, raw);
        let idx = [];
        try {
            idx = JSON.parse(sessionStorage.getItem(PERSIST_INDEX) || '[]');
        } catch (e) {
            idx = [];
        }
        idx = idx.filter(k => k !== url);
        idx.push(url);
        while (idx.length > PERSIST_MAX) {
            const oldest = idx.shift();
            sessionStorage.removeItem(PERSIST_PREFIX + oldest);
        }
        sessionStorage.setItem(PERSIST_INDEX, JSON.stringify(idx));
    } catch (e) {
        /* 隐私模式/超额：静默放弃持久化，内存缓存仍然生效 */
    }
}

// 把底层错误翻译成用户能看懂的一句话（网络断/超时/5xx 都走这里）
export function friendlyError(error) {
    if (!error) return '加载失败，请重试';
    if (error.name === 'AbortError') return '';
    if (error.name === 'TimeoutError') return '请求超时，请检查网络后重试';
    const status = error.status;
    if (status) {
        if (status === 429) return '请求过于频繁，请稍后重试';
        if (status === 404) return '数据不存在或已下架';
        if (status >= 500) return '服务器繁忙，请稍后重试';
        return `请求失败（${status}），请稍后重试`;
    }
    if (error.name === 'TypeError' || NETWORK_HINTS.test(error.message || '')) {
        return '网络连接失败，请稍后重试';
    }
    return error.message || '加载失败，请重试';
}

// 把「调用方取消」和「内部超时」合并成一个 signal
function createSignalGuard(signal, timeout) {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, timeout);
    const onAbort = () => controller.abort();
    if (signal) {
        if (signal.aborted) controller.abort();
        else signal.addEventListener('abort', onAbort);
    }
    return {
        signal: controller.signal,
        didTimeout: () => timedOut,
        release() {
            clearTimeout(timer);
            if (signal) signal.removeEventListener('abort', onAbort);
        }
    };
}

async function requestJson(url, { signal, timeout, retries, noStore = false }) {
    let lastError = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
        const guard = createSignalGuard(signal, timeout);
        try {
            // 走同源代理时不带 cookie：Vercel CDN 更愿意缓存「无凭据」的响应
            const init = { signal: guard.signal };
            if (noStore) init.cache = 'no-store';
            if (url.startsWith('/api/')) init.credentials = 'omit';
            const response = await fetch(url, init);
            const contentType = response.headers.get('content-type') || '';
            if (!response.ok) {
                const err = new Error(`HTTP ${response.status}`);
                err.status = response.status;
                err.isHtml = /text\/html/i.test(contentType);
                throw err;
            }
            // 正常接口只会是 JSON；拿到 HTML 说明被中间的验证页拦截了
            if (/text\/html/i.test(contentType)) {
                const err = new SyntaxError('响应不是 JSON');
                err.isHtml = true;
                throw err;
            }
            return await response.json();
        } catch (e) {
            // 调用方主动取消：不重试，直接把 AbortError 抛回（上层会忽略）
            if (signal && signal.aborted) throw e;
            if (guard.didTimeout() && e.name === 'AbortError') {
                const timeoutError = new Error('请求超时');
                timeoutError.name = 'TimeoutError';
                lastError = timeoutError;
            } else {
                lastError = e;
            }
            // 拿到验证页 / 代理自身报 502：没必要重试，立刻交给上层降级
            if (lastError.isHtml) throw lastError;
            // 4xx（限流除外）是确定性错误，重试没有意义
            const status = lastError.status;
            if (status && status >= 400 && status < 500 && status !== 429) throw lastError;
            if (attempt < retries) await sleep(RETRY_BASE_DELAY * (attempt + 1));
        } finally {
            guard.release();
        }
    }
    throw lastError || new Error('加载失败');
}

// 先试同源代理（能命中 CDN 就赚到），被拦就退回直连，并记住这次会话不再试
async function requestWithFallback(url, opts) {
    let target = url;
    if (isProxyUrl(target) && isProxyDisabled()) {
        target = directUrlFor(target) || target;
    }
    try {
        return await requestJson(target, opts);
    } catch (e) {
        const unusable = isProxyUrl(target) && e.name !== 'AbortError' && (e.isHtml || !e.status || e.status >= 500);
        if (!unusable) throw e;
        markProxyDisabled();
        const direct = directUrlFor(target);
        if (!direct) throw e;
        return await requestJson(direct, opts);
    }
}

export async function fetchJson(url, {
    force = false,
    signal,
    cache: useCache = true,
    persist = false,
    // 缓存 key 与真实请求地址分离：手动刷新时 key 不变（下次切回来还能读到刚刷新的数据），
    // 但这次请求走一个带 nocache 的地址绕过 CDN。
    networkUrl = url,
    timeout = DEFAULT_TIMEOUT,
    retries = DEFAULT_RETRIES
} = {}) {
    if (useCache && !force) {
        const hit = cacheGet(url);
        if (hit !== undefined) {
            if (persist) persistSet(url, hit);
            return hit;
        }
        // 同一请求已在飞行中：直接复用，不重复打源站
        const pending = inflight.get(url);
        if (pending) return pending;
    }

    const task = (async () => {
        const data = await requestWithFallback(networkUrl, { signal, timeout, retries, noStore: force });
        if (useCache) {
            cacheSet(url, data);
            if (persist) persistSet(url, data);
        }
        return data;
    })();

    inflight.set(url, task);
    task.then(
        () => inflight.delete(url),
        () => inflight.delete(url)
    );
    return task;
}

// 清空缓存（登录/登出等场景）
export function clearApiCache() {
    cache.clear();
}

// 战区数据：week 为 null 表示本周；force 为 true 时跳过缓存（手动刷新）
function warzonePath(difficulty, week) {
    const weekPath = week == null ? 'current' : week;
    return `/servers/cn/warzone/${weekPath}/${difficulty}`;
}

function warzoneUrl(difficulty, week) {
    return apiUrl(warzonePath(difficulty, week));
}

function normalizeWarzone(result) {
    if (!result || result.status !== 'success' || !result.data || !result.data.warzone) {
        throw new Error('数据格式异常，请刷新重试');
    }
    return {
        warzone: result.data.warzone,
        rankings: result.data.rankings,
        activities: result.data.activities || null
    };
}

// 本地已缓存的战区数据（不触发网络）。age 为毫秒，用来决定要不要后台刷新。
export function peekWarzone(difficulty, week) {
    const url = warzoneUrl(difficulty, week);
    const fresh = cacheGet(url);
    if (fresh !== undefined) {
        try {
            return { data: normalizeWarzone(fresh), age: 0 };
        } catch (e) {
            return null;
        }
    }
    const rec = persistGet(url);
    if (!rec) return null;
    try {
        return { data: normalizeWarzone(rec.data), age: Date.now() - rec.ts };
    } catch (e) {
        return null;
    }
}

export async function loadWarzone(difficulty, week, force = false) {
    const url = warzoneUrl(difficulty, week);
    const networkUrl = force ? apiUrlNoCache(warzonePath(difficulty, week)) : url;
    const result = await fetchJson(url, { force, persist: true, networkUrl });
    return normalizeWarzone(result);
}

export async function loadPlayer(playerId, signal) {
    let result;
    try {
        result = await fetchJson(apiUrl(`/servers/cn/players/${playerId}`), { signal });
    } catch (e) {
        if (signal && signal.aborted) throw e;
        // 404 = 真的没有这个玩家；其余（断网/超时/5xx）交给上层报网络错误
        if (e && e.status === 404) {
            const notFound = new Error('未找到该玩家');
            notFound.notFound = true;
            throw notFound;
        }
        throw e;
    }
    if (result.status === 'error' || !result.data) {
        const notFound = new Error('未找到该玩家');
        notFound.notFound = true;
        throw notFound;
    }
    return result.data;
}

export async function loadPpc(week, level) {
    const weekPath = week == null ? 'current' : week;
    const result = await fetchJson(apiUrl(`/servers/cn/ppc/${weekPath}/${level}`, 'ranking=true'));
    if (result.status !== 'success' || !result.data) {
        throw new Error('数据格式异常，请刷新重试');
    }
    return result.data;
}
