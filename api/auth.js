// Vercel Serverless Function: 用户登录/注册
// POST /api/auth
// body: { action: "login"|"register", playerId: string, password: string }

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

// scrypt 密码哈希（加盐）
function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
}

// 验证密码
function verifyPassword(password, stored) {
    const [salt, hash] = stored.split(':');
    if (!salt || !hash) return false;
    const verify = crypto.scryptSync(password, salt, 64).toString('hex');
    return hash === verify;
}

// 生成随机 session token
function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

// 获取玩家名（从 huaxu API）
async function fetchPlayerName(playerId) {
    try {
        const resp = await fetch(`https://api.huaxu.app/servers/cn/players/${playerId}`, {
            headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
        });
        const result = await resp.json();
        if (result.status === 'success' && result.data?.player?.name) {
            return result.data.player.name;
        }
    } catch { /* 忽略 */ }
    return '';
}

module.exports = async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { action, playerId, password } = req.body;

    // 参数验证
    if (!playerId || !password) {
        return res.status(400).json({ error: '请输入游戏ID和密码' });
    }

    if (typeof playerId !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ error: '参数格式错误' });
    }

    const trimmedId = playerId.trim();
    const trimmedPw = password.trim();

    if (trimmedId.length < 1 || trimmedPw.length < 4) {
        return res.status(400).json({ error: '密码至少4个字符' });
    }

    try {
        // 查询用户是否存在
        const { data: existingUser } = await supabase
            .from('users')
            .select('player_id, password_hash, player_name')
            .eq('player_id', trimmedId)
            .single();

        // 注册：用户必须不存在
        if (action === 'register') {
            if (existingUser) {
                return res.status(409).json({ error: '该ID已注册，请直接登录' });
            }

            const playerName = await fetchPlayerName(trimmedId);
            const passwordHash = hashPassword(trimmedPw);

            const { error: insertError } = await supabase
                .from('users')
                .insert({
                    player_id: trimmedId,
                    password_hash: passwordHash,
                    player_name: playerName
                });

            if (insertError) {
                console.error('Insert user error:', insertError);
                return res.status(500).json({ error: '注册失败，请重试' });
            }

            const token = generateToken();
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

            await supabase.from('sessions').insert({
                token, player_id: trimmedId, expires_at: expiresAt
            });

            return res.status(200).json({
                status: 'success',
                data: { token, playerId: trimmedId, playerName }
            });
        }

        // 登录（用户不存在时自动注册）
        if (existingUser) {
            // 验证密码
            if (!verifyPassword(trimmedPw, existingUser.password_hash)) {
                return res.status(401).json({ error: '密码错误' });
            }

            const token = generateToken();
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

            await supabase.from('sessions').insert({
                token, player_id: trimmedId, expires_at: expiresAt
            });

            return res.status(200).json({
                status: 'success',
                data: {
                    token,
                    playerId: trimmedId,
                    playerName: existingUser.player_name || ''
                }
            });
        } else {
            // 用户不存在，自动注册
            const playerName = await fetchPlayerName(trimmedId);
            const passwordHash = hashPassword(trimmedPw);

            const { error: insertError } = await supabase
                .from('users')
                .insert({
                    player_id: trimmedId,
                    password_hash: passwordHash,
                    player_name: playerName
                });

            if (insertError) {
                console.error('Auto-register error:', insertError);
                return res.status(500).json({ error: '注册失败，请重试' });
            }

            const token = generateToken();
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

            await supabase.from('sessions').insert({
                token, player_id: trimmedId, expires_at: expiresAt
            });

            return res.status(200).json({
                status: 'success',
                data: { token, playerId: trimmedId, playerName }
            });
        }
    } catch (error) {
        console.error('Auth error:', error);
        return res.status(500).json({ error: '服务器错误' });
    }
};
