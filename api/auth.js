// Vercel Serverless Function: 用户登录/注册
// POST /api/auth
// body: { action: "login"|"register", playerId: string, password: string }

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
const supabaseKey = (process.env.SUPABASE_SERVICE_KEY || '').replace(/[\r\n\s]/g, '');

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars: SUPABASE_URL=' + !!supabaseUrl + ' SUPABASE_SERVICE_KEY=' + !!supabaseKey);
}

const supabase = createClient(supabaseUrl, supabaseKey);

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

// 用户名格式校验：2-20 位字母或数字
function isValidUsername(name) {
    return /^[A-Za-z0-9]{2,20}$/.test(name);
}

// 调库街区接口（后端，无 CORS 限制）
async function kuroPost(path, { token, data = {}, source = 'h5' } = {}) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let devcode = '';
    for (let i = 0; i < 32; i++) devcode += chars.charAt(Math.floor(Math.random() * chars.length));
    const headers = {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'source': source,
        'devcode': devcode
    };
    if (token) headers['token'] = token;
    const resp = await fetch(`https://api.kurobbs.com${path}`, {
        method: 'POST',
        headers,
        body: new URLSearchParams(data).toString()
    });
    return resp.json();
}

// 查询账号云端绑定的库街区手机号
async function getKuroPhone(username) {
    const { data } = await supabase
        .from('user_data')
        .select('data')
        .eq('player_id', username)
        .eq('data_key', 'kuro_phone')
        .single();
    return data ? String(data.data || '') : '';
}

// 手机号脱敏：138****1234
function maskPhone(phone) {
    if (!phone || phone.length < 7) return '';
    return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
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

    const { action, playerId, password, token } = req.body;

    // 登出：删除服务端 session
    if (action === 'logout') {
        if (!token) return res.status(400).json({ error: '缺少 token' });
        await supabase.from('sessions').delete().eq('token', token);
        return res.status(200).json({ status: 'success' });
    }

    // 用库街区登录网站账号：验证 token 有效 → 按手机号反查绑定账号 → 签发 session
    if (action === 'kuro_login') {
        const { token: kuroToken, phone } = req.body || {};
        if (!kuroToken || !phone) {
            return res.status(400).json({ error: '缺少库街区凭证' });
        }
        try {
            // 1. 后端验证库街区 token 真实有效（调 role/list）
            const kuroResp = await kuroPost('/gamer/role/list', { token: kuroToken, data: { gameId: 2 } });
            if (!kuroResp || (kuroResp.code !== 0 && kuroResp.code !== 200)) {
                return res.status(401).json({ error: '库街区凭证已失效，请重新绑定' });
            }
            // 2. 按手机号反查网站账号
            const { data: bindRow } = await supabase
                .from('user_data')
                .select('player_id')
                .eq('data_key', 'kuro_phone')
                .eq('data', phone)
                .single();
            let playerId = bindRow ? bindRow.player_id : null;
            if (!playerId) {
                // 兜底：按 token 反查（云端可能只有 token 记录）
                const { data: byToken } = await supabase
                    .from('user_data')
                    .select('player_id')
                    .eq('data_key', 'kuro_token')
                    .eq('data', kuroToken)
                    .single();
                playerId = byToken ? byToken.player_id : null;
            }
            if (!playerId) {
                console.error('[kuro_login] 反查失败 phone=' + phone + ' tokenLen=' + String(kuroToken || '').length);
                return res.status(404).json({ error: '云端未找到该库街区账号与网站账号的绑定关系。请先登录网站账号，并在「我的」页重新绑定一次库街区（绑定即自动关联）' });
            }
            // 3. 签发 session
            const playerId = bindRow.player_id;
            const { data: userRow } = await supabase
                .from('users')
                .select('player_name')
                .eq('player_id', playerId)
                .single();
            const sessionToken = generateToken();
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
            await supabase.from('sessions').insert({
                token: sessionToken, player_id: playerId, expires_at: expiresAt
            });
            return res.status(200).json({
                status: 'success',
                data: { token: sessionToken, playerId, playerName: (userRow && userRow.player_name) || playerId }
            });
        } catch (error) {
            console.error('Kuro login error:', error.message);
            return res.status(500).json({ error: '服务器错误: ' + error.message });
        }
    }

    // 找回密码 Step1：返回账号绑定的库街区手机号（脱敏）
    if (action === 'reset_phone') {
        const username = String((req.body || {}).username || '').trim();
        if (!isValidUsername(username)) {
            return res.status(400).json({ error: '用户名格式不正确' });
        }
        const phone = await getKuroPhone(username);
        if (!phone) {
            return res.status(404).json({ error: '该账号未绑定库街区，无法自助找回，请联系站长' });
        }
        return res.status(200).json({ status: 'success', data: { phone } });
    }

    // 找回密码 Step2：库街区验证码验证通过后重置密码，并清空所有 session
    if (action === 'reset') {
        const { username, phone, code, newPassword } = req.body || {};
        const uname = String(username || '').trim();
        if (!isValidUsername(uname)) {
            return res.status(400).json({ error: '用户名格式不正确' });
        }
        if (!/^.{6,20}$/.test(String(newPassword || ''))) {
            return res.status(400).json({ error: '密码需为6-20位' });
        }
        try {
            // 账号绑定的手机号必须匹配
            const boundPhone = await getKuroPhone(uname);
            if (!boundPhone || boundPhone !== String(phone || '')) {
                return res.status(400).json({ error: '手机号与账号绑定不一致' });
            }
            // 库街区验证码验证（sdkLogin 成功 = 短信持有者 = 本人）
            let devcode = '';
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            for (let i = 0; i < 32; i++) devcode += chars.charAt(Math.floor(Math.random() * chars.length));
            const kuroResp = await kuroPost('/user/sdkLoginForH5', {
                data: { mobile: boundPhone, code: String(code || ''), devCode: devcode }
            });
            if (!kuroResp || (kuroResp.code !== 0 && kuroResp.code !== 200)) {
                return res.status(401).json({ error: '验证码错误或已过期' });
            }
            // 重置密码 + 清空所有 session（强制重新登录）
            const passwordHash = hashPassword(String(newPassword));
            await supabase.from('users').update({
                password_hash: passwordHash,
                login_fail_count: 0,
                locked_until: null
            }).eq('player_id', uname);
            await supabase.from('sessions').delete().eq('player_id', uname);
            return res.status(200).json({ status: 'success', msg: '密码已重置，请重新登录' });
        } catch (error) {
            console.error('Reset error:', error.message);
            return res.status(500).json({ error: '服务器错误: ' + error.message });
        }
    }

    // 参数验证
    if (!playerId || !password) {
        return res.status(400).json({ error: '请输入用户名和密码' });
    }

    if (typeof playerId !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ error: '参数格式错误' });
    }

    const trimmedId = playerId.trim();
    const trimmedPw = password.trim();

    if (!isValidUsername(trimmedId)) {
        return res.status(400).json({ error: '用户名需为2-20位字母或数字' });
    }

    if (trimmedPw.length < 4) {
        return res.status(400).json({ error: '密码至少4个字符' });
    }

    try {
        // 查询用户是否存在
        const { data: existingUser } = await supabase
            .from('users')
            .select('player_id, password_hash, player_name, login_fail_count, locked_until')
            .eq('player_id', trimmedId)
            .single();

        // 注册：用户必须不存在（用户名即身份，无需绑定游戏ID）
        if (action === 'register') {
            if (existingUser) {
                return res.status(409).json({ error: '该用户名已注册，请直接登录' });
            }
            if (!/^.{6,20}$/.test(trimmedPw)) {
                return res.status(400).json({ error: '密码需为6-20位' });
            }

            const passwordHash = hashPassword(trimmedPw);

            const { error: insertError } = await supabase
                .from('users')
                .insert({
                    player_id: trimmedId,
                    password_hash: passwordHash,
                    player_name: trimmedId
                });

            if (insertError) {
                // 唯一约束冲突（并发抢注）
                if (insertError.code === '23505') {
                    return res.status(409).json({ error: '该用户名已注册，请直接登录' });
                }
                console.error('Insert user error:', JSON.stringify(insertError));
                return res.status(500).json({ error: '注册失败: ' + (insertError.message || '未知错误') });
            }

            const token = generateToken();
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

            await supabase.from('sessions').insert({
                token, player_id: trimmedId, expires_at: expiresAt
            });

            return res.status(200).json({
                status: 'success',
                data: { token, playerId: trimmedId, playerName: trimmedId }
            });
        }

        // 登录：用户不存在时拒绝（不再自动注册，防止抢注）
        if (!existingUser) {
            return res.status(404).json({ error: '该用户名未注册，请先注册' });
        }

        // 锁定检查（连续失败 5 次锁定 15 分钟）
        if (existingUser.locked_until && new Date(existingUser.locked_until) > new Date()) {
            return res.status(423).json({ error: '尝试次数过多，请15分钟后再试' });
        }

        // 验证密码
        if (!verifyPassword(trimmedPw, existingUser.password_hash)) {
            const failCount = (existingUser.login_fail_count || 0) + 1;
            const locked = failCount >= 5;
            await supabase.from('users').update({
                login_fail_count: locked ? 0 : failCount,
                locked_until: locked ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null
            }).eq('player_id', trimmedId);
            return res.status(401).json({ error: '密码错误' });
        }

        // 登录成功：清零失败计数
        if (existingUser.login_fail_count || existingUser.locked_until) {
            await supabase.from('users').update({
                login_fail_count: 0,
                locked_until: null
            }).eq('player_id', trimmedId);
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
    } catch (error) {
        console.error('Auth error:', error.message, error.stack);
        return res.status(500).json({ error: '服务器错误: ' + error.message });
    }
};
