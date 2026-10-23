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

// 调库街区接口（后端，无 CORS 限制；带 8s 超时，避免 Vercel 函数超时被杀）
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
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
        const resp = await fetch(`https://api.kurobbs.com${path}`, {
            method: 'POST',
            headers,
            body: new URLSearchParams(data).toString(),
            signal: controller.signal
        });
        return resp.json();
    } finally {
        clearTimeout(timer);
    }
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

// 手机号格式校验（国内 11 位）
function isValidPhone(phone) {
    return /^1[3-9]\d{9}$/.test(String(phone || ''));
}

// 用「手机号 + 短信验证码」登录库街区，返回 kuro token
// 关键：验证码由库街区校验，所以手机号归属可信；前端传的手机号不能直接当账号用
async function kuroLoginByCode(phone, code) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let devcode = '';
    for (let i = 0; i < 32; i++) devcode += chars.charAt(Math.floor(Math.random() * chars.length));
    const data = { mobile: phone, code: String(code), devCode: devcode };
    let resp = null;
    for (const path of ['/user/sdkLoginForH5', '/user/sdkLogin']) {
        resp = await kuroPost(path, { data });
        if (resp && (resp.code === 0 || resp.code === 200)) {
            const payload = resp.data || {};
            return payload.token || (typeof payload === 'string' ? payload : '');
        }
        // 验证码错误/过期/风控：换接口也没意义，直接抛
        if (resp && (resp.code === 130 || resp.code === 132 || resp.code === 270)) break;
    }
    const err = new Error((resp && resp.msg) || '验证码错误或已过期');
    err.kuroCode = resp && resp.code;
    throw err;
}

// 按云端绑定的库街区手机号反查老账号
// 改版前注册的用户没有手机号列，靠 user_data 里的 kuro_phone 匹配置信接管，历史数据不丢
async function findPlayerIdByKuroPhone(phone) {
    // data 列是 jsonb，字符串值要用带引号的 JSON 字面量比较
    for (const val of [JSON.stringify(phone), phone]) {
        try {
            const { data, error } = await supabase
                .from('user_data')
                .select('player_id')
                .eq('data_key', 'kuro_phone')
                .filter('data', 'eq', val)
                .limit(1);
            if (!error && data && data.length) return data[0].player_id;
        } catch { /* 换下一种写法再试 */ }
    }
    return null;
}

// 该账号是否已有战区历史（用来判断两个候选账号里哪个才是"真身"）
async function hasScoreData(playerId) {
    const { data } = await supabase
        .from('user_data')
        .select('player_id')
        .eq('player_id', playerId)
        .eq('data_key', 'wz_scores')
        .limit(1);
    return !!(data && data.length);
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
        try {
            const { error: delError } = await supabase.from('sessions').delete().eq('token', token);
            if (delError) {
                console.error('Logout delete error:', JSON.stringify(delError));
                return res.status(500).json({ error: '登出失败: ' + delError.message });
            }
            return res.status(200).json({ status: 'success' });
        } catch (error) {
            console.error('Logout error:', error.message, error.stack);
            return res.status(500).json({ error: '登出失败: ' + error.message });
        }
    }

    // 找回密码 Step1：返回账号绑定的库街区手机号（脱敏，不泄露完整号码）
    if (action === 'reset_phone') {
        const username = String((req.body || {}).username || '').trim();
        if (!isValidUsername(username)) {
            return res.status(400).json({ error: '用户名格式不正确' });
        }
        const phone = await getKuroPhone(username);
        if (!phone) {
            return res.status(404).json({ error: '该账号未绑定库街区，无法自助找回，请联系站长' });
        }
        return res.status(200).json({ status: 'success', data: { phone: maskPhone(phone) } });
    }

    // 找回密码：后端代发验证码（极验结果由前端产生，后端用云端绑定手机号发码，前端无需完整号码）
    if (action === 'send_reset_code') {
        const { username, geeTestData } = req.body || {};
        const uname = String(username || '').trim();
        if (!isValidUsername(uname)) {
            return res.status(400).json({ error: '用户名格式不正确' });
        }
        if (!geeTestData || typeof geeTestData !== 'string' || geeTestData.length > 4000) {
            return res.status(400).json({ error: '缺少验证信息' });
        }
        try {
            const boundPhone = await getKuroPhone(uname);
            if (!boundPhone) {
                return res.status(404).json({ error: '该账号未绑定库街区，无法自助找回，请联系站长' });
            }
            const kuroResp = await kuroPost('/user/getSmsCodeForH5', {
                data: { mobile: boundPhone, geeTestData }
            });
            if (!kuroResp || (kuroResp.code !== 0 && kuroResp.code !== 200)) {
                return res.status(400).json({ error: (kuroResp && kuroResp.msg) || '验证码发送失败' });
            }
            return res.status(200).json({ status: 'success' });
        } catch (error) {
            console.error('Send reset code error:', error.message);
            return res.status(500).json({ error: '验证码发送失败' });
        }
    }

    // 找回密码 Step2：库街区验证码验证通过后重置密码，并清空所有 session
    if (action === 'reset') {
        const { username, code, newPassword } = req.body || {};
        const uname = String(username || '').trim();
        if (!isValidUsername(uname)) {
            return res.status(400).json({ error: '用户名格式不正确' });
        }
        if (!/^.{6,20}$/.test(String(newPassword || ''))) {
            return res.status(400).json({ error: '密码需为6-20位' });
        }
        try {
            // 用云端绑定的手机号验证（前端不传手机号，防止被篡改）
            const boundPhone = await getKuroPhone(uname);
            if (!boundPhone) {
                return res.status(404).json({ error: '该账号未绑定库街区，无法自助找回，请联系站长' });
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

    // 手机号一次性登录：库街区校验验证码 → 查/建账号 → 发网站 session
    // 同一个验证码顺带把库街区 token 写进云端，用户不再需要单独「绑定库街区」
    if (action === 'phone_login') {
        const { phone, code } = req.body || {};
        const p = String(phone || '').trim();
        const c = String(code || '').trim();
        if (!isValidPhone(p)) {
            return res.status(400).json({ error: '请输入正确的11位手机号' });
        }
        if (!/^\d{4,8}$/.test(c)) {
            return res.status(400).json({ error: '请输入短信验证码' });
        }

        let kuroToken = '';
        try {
            kuroToken = await kuroLoginByCode(p, c);
        } catch (e) {
            const map = {
                130: '验证码错误，请重新输入',
                132: '验证码已过期，请重新获取',
                270: '当前网络环境存在风险，请切换网络（Wi-Fi ↔ 流量）后重试'
            };
            return res.status(401).json({ error: map[e.kuroCode] || '验证码错误或已过期' });
        }

        try {
            // 身份优先级：手机号账号 → 云端 kuro_phone 匹配到的老账号 → 新建
            let playerId = p;
            let playerName = maskPhone(p);
            let adopted = false;

            const { data: phoneUser } = await supabase
                .from('users')
                .select('player_id, player_name')
                .eq('player_id', p)
                .maybeSingle();
            const oldId = await findPlayerIdByKuroPhone(p);

            const adoptOld = async () => {
                playerId = oldId;
                adopted = true;
                const { data: oldUser } = await supabase
                    .from('users')
                    .select('player_name')
                    .eq('player_id', oldId)
                    .maybeSingle();
                if (oldUser && oldUser.player_name) playerName = oldUser.player_name;
            };

            if (phoneUser) {
                playerName = phoneUser.player_name || playerName;
                // 手机号账号若是空壳、老账号却有分数 → 用老账号，历史数据不丢
                if (oldId && oldId !== p && !(await hasScoreData(p)) && (await hasScoreData(oldId))) {
                    await adoptOld();
                }
            } else if (oldId) {
                await adoptOld();
            } else {
                // 首次登录自动建号：随机密码（用户无需知道，也登录不了密码通道）
                const passwordHash = hashPassword(crypto.randomBytes(16).toString('hex'));
                const { error: insertError } = await supabase
                    .from('users')
                    .insert({ player_id: p, password_hash: passwordHash, player_name: playerName });
                if (insertError && insertError.code !== '23505') {
                    console.error('Phone register error:', JSON.stringify(insertError));
                    return res.status(500).json({ error: '登录失败: ' + (insertError.message || '未知错误') });
                }
            }

            // 同一个验证码顺带完成库街区绑定（换设备也能自动恢复）
            const now = new Date().toISOString();
            const rows = [{ player_id: playerId, data_key: 'kuro_phone', data: p, updated_at: now }];
            if (kuroToken) {
                rows.unshift({ player_id: playerId, data_key: 'kuro_token', data: kuroToken, updated_at: now });
            }
            await supabase.from('user_data').upsert(rows, { onConflict: 'player_id,data_key' });

            const token = generateToken();
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
            await supabase.from('sessions').insert({ token, player_id: playerId, expires_at: expiresAt });

            return res.status(200).json({
                status: 'success',
                data: { token, playerId, playerName, kuroToken, kuroPhone: p, adopted }
            });
        } catch (error) {
            console.error('Phone login error:', error.message, error.stack);
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
        // 查询用户是否存在（maybeSingle：无记录不报错，避免重复数据导致登录失败）
        const { data: existingUser } = await supabase
            .from('users')
            .select('player_id, password_hash, player_name, login_fail_count, locked_until')
            .eq('player_id', trimmedId)
            .maybeSingle();

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
