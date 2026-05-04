// Vercel Serverless Function: 用户数据 CRUD
// GET    /api/user-data          Header: Authorization: Bearer <token>
// PUT    /api/user-data          Header: Authorization: Bearer <token>, Body: { key, data }
// DELETE /api/user-data          Header: Authorization: Bearer <token>, Body: { key }

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

const ALLOWED_KEYS = ['bind', 'history', 'follows', 'wz_scores', 'ppc_scores'];

// 从 Authorization header 提取 token
function getToken(req) {
    const auth = req.headers.authorization;
    if (auth && auth.startsWith('Bearer ')) {
        return auth.slice(7);
    }
    // 兼容 query 参数（GET 请求降级）
    return req.query?.token || null;
}

// 验证 session token，返回 player_id 或 null
async function verifyToken(token) {
    if (!token) return null;

    const { data: session } = await supabase
        .from('sessions')
        .select('player_id, expires_at')
        .eq('token', token)
        .single();

    if (!session) return null;

    // 检查是否过期
    if (new Date(session.expires_at) < new Date()) {
        await supabase.from('sessions').delete().eq('token', token);
        return null;
    }

    return session.player_id;
}

module.exports = async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const token = getToken(req);
        const playerId = await verifyToken(token);

        if (!playerId) {
            return res.status(401).json({ error: '登录已过期，请重新登录' });
        }

        // GET: 获取所有用户数据
        if (req.method === 'GET') {
            const { data, error } = await supabase
                .from('user_data')
                .select('data_key, data')
                .eq('player_id', playerId);

            if (error) {
                console.error('Fetch data error:', error);
                return res.status(500).json({ error: '获取数据失败' });
            }

            const result = {};
            data.forEach(row => {
                result[row.data_key] = row.data;
            });

            return res.status(200).json({ status: 'success', data: result });
        }

        // PUT: 保存单条数据
        if (req.method === 'PUT') {
            const { key, data: payload } = req.body;

            if (!ALLOWED_KEYS.includes(key)) {
                return res.status(400).json({ error: '无效的数据类型' });
            }

            const { error } = await supabase
                .from('user_data')
                .upsert({
                    player_id: playerId,
                    data_key: key,
                    data: payload,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'player_id,data_key'
                });

            if (error) {
                console.error('Save data error:', error);
                return res.status(500).json({ error: '保存失败' });
            }

            return res.status(200).json({ status: 'success' });
        }

        // DELETE: 删除单条数据
        if (req.method === 'DELETE') {
            const { key } = req.body;

            if (!ALLOWED_KEYS.includes(key)) {
                return res.status(400).json({ error: '无效的数据类型' });
            }

            const { error } = await supabase
                .from('user_data')
                .delete()
                .eq('player_id', playerId)
                .eq('data_key', key);

            if (error) {
                console.error('Delete data error:', error);
                return res.status(500).json({ error: '删除失败' });
            }

            return res.status(200).json({ status: 'success' });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('User data error:', error);
        return res.status(500).json({ error: '服务器错误' });
    }
};
