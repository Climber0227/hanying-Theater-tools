// Vercel Serverless Function: 上游 huaxu.app 的缓存代理
// GET /api/huaxu?path=/servers/cn/warzone/current/16
// 目的：
//   1) 把榜单/玩家请求从「浏览器直连 api.huaxu.app」改成「同源 + CDN 缓存」，
//      命中缓存时函数根本不执行，用户也不用等源站偶发的 20s 卡顿；
//   2) 每次成功响应留一份快照，源站抖动时直接返回上一份（stale），不让页面空白。
// 安全：path 必须命中白名单正则，避免变成任意 URL 代理。

const UPSTREAM = (process.env.HUAXU_UPSTREAM || 'https://api.huaxu.app').replace(/\/+$/, '');
const TIMEOUT = Number(process.env.HUAXU_TIMEOUT || 9000); // 源站偶发 20s+，9s 就放弃并兜底
const SNAPSHOT_TTL = 30 * 60 * 1000; // 快照最多兜底 30 分钟
const SNAPSHOT_MAX = 60;

// 白名单：只允许这些真实用到的路径（末尾不带 query）
const RULES = [
    { re: /^\/servers\/cn\/warzone\/(current|\d{1,4})\/(1[0-6]|[1-9])$/, ttl: 60, name: 'warzone' },
    { re: /^\/servers\/cn\/ppc\/(current|\d{1,4})\/\d{1,2}$/, ttl: 60, name: 'ppc' },
    { re: /^\/servers\/cn\/players\/\d{1,12}\/warzone$/, ttl: 300, name: 'player-history' },
    { re: /^\/servers\/cn\/players\/\d{1,12}\/characters\/\d{1,12}$/, ttl: 3600, name: 'character' },
    { re: /^\/servers\/cn\/players\/\d{1,12}$/, ttl: 120, name: 'player' }
];

// 进程内快照：同一个 lambda 实例复用，源站挂了也能立刻答
const snapshots = new Map(); // key -> { body, ts, contentType }

function remember(key, body, contentType) {
    snapshots.delete(key);
    snapshots.set(key, { body, ts: Date.now(), contentType });
    while (snapshots.size > SNAPSHOT_MAX) {
        const oldest = snapshots.keys().next().value;
        if (oldest === undefined) break;
        snapshots.delete(oldest);
    }
}

function recall(key) {
    const hit = snapshots.get(key);
    if (!hit) return null;
    if (Date.now() - hit.ts > SNAPSHOT_TTL) {
        snapshots.delete(key);
        return null;
    }
    return hit;
}

function matchRule(path) {
    for (const rule of RULES) {
        if (rule.re.test(path)) return rule;
    }
    return null;
}

async function fetchUpstream(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT);
    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                Accept: 'application/json, text/plain, */*',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
            }
        });
        const text = await response.text();
        return { ok: response.ok, status: response.status, text, contentType: response.headers.get('content-type') || 'application/json; charset=utf-8' };
    } finally {
        clearTimeout(timer);
    }
}

function sendText(res, status, body, contentType) {
    res.statusCode = status;
    if (contentType) res.setHeader('Content-Type', contentType);
    return res.end(body);
}

function sendJson(res, status, obj) {
    return sendText(res, status, JSON.stringify(obj), 'application/json; charset=utf-8');
}

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.statusCode = 200;
        return res.end();
    }
    if (req.method !== 'GET') return sendJson(res, 405, { status: 'error', error: 'Method not allowed' });

    const rawPath = String(req.query?.path || '');
    // path 允许带前导斜杠，也允许不带；统一补上
    const apiPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
    if (!apiPath || apiPath.length > 120 || apiPath.includes('..') || apiPath.includes('//')) {
        return sendJson(res, 400, { status: 'error', error: 'invalid path' });
    }

    const rule = matchRule(apiPath);
    if (!rule) return sendJson(res, 400, { status: 'error', error: 'path not allowed' });

    // 附加 query（目前只有 ppc 的 ranking=true），严格限制字符集
    const extra = String(req.query?.q || '');
    if (extra && !/^[a-zA-Z0-9=&_-]{1,60}$/.test(extra)) {
        return sendJson(res, 400, { status: 'error', error: 'invalid query' });
    }

    const target = `${UPSTREAM}${apiPath}${extra ? `?${extra}` : ''}`;
    const key = `${apiPath}?${extra}`;
    const nocache = String(req.query?.nocache || '') === '1';
    const started = Date.now();

    try {
        let result = await fetchUpstream(target);
        if (!result.ok && (result.status >= 500 || result.status === 429)) {
            // 5xx/限流允许再来一次，两次都失败才用快照
            await new Promise(r => setTimeout(r, 250));
            result = await fetchUpstream(target);
        }

        // 源站明确说「没有」（4xx）：原样透传，不写快照、不缓存
        if (!result.ok && result.status < 500 && result.status !== 429) {
            res.setHeader('Cache-Control', 'no-store');
            return sendText(res, result.status, result.text, result.contentType);
        }

        if (!result.ok) return serveStale(res, key, `upstream ${result.status}`, started);

        remember(key, result.text, result.contentType);
        res.setHeader('Content-Type', result.contentType);
        res.setHeader('X-Data-State', 'fresh');
        res.setHeader('X-Proxy-Ms', String(Date.now() - started));
        if (nocache) {
            res.setHeader('Cache-Control', 'no-store');
        } else {
            // s-maxage 决定 CDN 缓存时长；stale-while-revalidate 让过期后先给旧数据、后台再刷；
            // stale-if-error 保证源站报错时 CDN 继续发旧数据而不是把 502 抛给用户。
            const cc = `public, s-maxage=${rule.ttl}, stale-while-revalidate=600, stale-if-error=86400`;
            res.setHeader('Cache-Control', cc);
            res.setHeader('CDN-Cache-Control', cc);
            res.setHeader('Vercel-CDN-Cache-Control', cc);
        }
        return sendText(res, 200, result.text, result.contentType);
    } catch (err) {
        return serveStale(res, key, err?.name === 'AbortError' ? 'timeout' : err?.message, started);
    }
};

function serveStale(res, key, reason, started) {
    const snap = recall(key);
    if (snap) {
        res.setHeader('Content-Type', snap.contentType);
        res.setHeader('X-Data-State', 'stale');
        res.setHeader('X-Proxy-Reason', String(reason || '').slice(0, 60));
        res.setHeader('X-Proxy-Ms', String(Date.now() - started));
        // 短暂的 CDN 缓存，避免源站恢复前每个用户都触发一次回源
        res.setHeader('Cache-Control', 'public, s-maxage=10, stale-if-error=600');
        return sendText(res, 200, snap.body, snap.contentType);
    }
    res.setHeader('Cache-Control', 'no-store');
    return sendJson(res, 504, { status: 'error', error: 'upstream_unavailable' });
}
