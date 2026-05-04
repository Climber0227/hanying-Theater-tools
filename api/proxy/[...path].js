// Vercel Serverless Function: API 代理
// 将 /api/proxy/... 请求转发到 https://api.huaxu.app/...
// 解决前端直接调用 huaxu.app 的跨域问题

const TARGET = 'https://api.huaxu.app';

module.exports = async function handler(req, res) {
    // CORS 头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // 拼接目标 URL
    const pathParts = req.query.path || [];
    const targetPath = Array.isArray(pathParts) ? pathParts.join('/') : pathParts;
    const targetUrl = `${TARGET}/${targetPath}`;

    // 传递 query string（排除 path 参数）
    const { path: _, ...otherQuery } = req.query;
    const qs = new URLSearchParams(otherQuery).toString();
    const fullUrl = qs ? `${targetUrl}?${qs}` : targetUrl;

    try {
        const response = await fetch(fullUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-origin'
            }
        });

        const contentType = response.headers.get('content-type') || '';
        const isJson = contentType.includes('application/json');

        // 缓存热门请求 60 秒
        res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');

        if (isJson) {
            const data = await response.json();
            return res.status(response.status).json(data);
        } else {
            const text = await response.text();
            res.setHeader('Content-Type', contentType);
            return res.status(response.status).send(text);
        }
    } catch (error) {
        console.error('Proxy error:', error.message);
        return res.status(502).json({
            status: 'error',
            message: '代理请求失败'
        });
    }
};
