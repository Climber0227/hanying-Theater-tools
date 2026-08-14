// Vercel Serverless Function: 趋势曲线采样（前端被动上传，替代 Cron）
// POST /api/trends → { week, difficulty, samples: [{ playerId, name, zones, total }] }
// 入库去重：unique (week, sampled_at, player_id, difficulty)
// 安全：删除操作仅允许携带 x-cron-secret（与 CRON_SECRET 匹配的可信 GitHub Actions cron）的请求执行，
//       普通上传（前端/任意第三方）只能插入，无法触发任何删除，防止未鉴权清库

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
const supabaseKey = (process.env.SUPABASE_SERVICE_KEY || '').replace(/[\r\n\s]/g, '');
const supabase = createClient(supabaseUrl, supabaseKey);

const CRON_SECRET = (process.env.CRON_SECRET || '').trim(); // 与 GitHub Actions secret 保持一致
const MAX_SAMPLES = 300; // 单次采样最多玩家数（榜单上限）
const MAX_WEEK = 2000; // 绝对周号上界（源站当前约 582，留足余量防乱传）
const DIFF_RE = /^(1[0-6]|[1-9])$/; // 难度 1~16

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-cron-secret');
    res.setHeader('Cache-Control', 'no-store');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // 仅可信 cron 可执行删除类操作（定时清理旧周数据）
    const isCron = CRON_SECRET && req.headers['x-cron-secret'] === CRON_SECRET;

    let body;
    try {
        body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    } catch { return res.status(400).json({ error: '无效请求' }); }

    const week = parseInt(body.week);
    const difficulty = String(body.difficulty || '').trim();
    const samples = Array.isArray(body.samples) ? body.samples : [];

    if (!Number.isInteger(week) || week <= 0 || week > MAX_WEEK) return res.status(400).json({ error: 'week 无效' });
    if (!DIFF_RE.test(difficulty)) return res.status(400).json({ error: 'difficulty 无效' });
    if (samples.length === 0 || samples.length > MAX_SAMPLES) return res.status(400).json({ error: 'samples 数量无效' });

    // 采样时间：cron 传 5 分钟对齐时间戳（幂等去重，重试不堆积），普通上传用服务端当前时间
    const bodySampledAt = String(body.sampled_at || '').trim();
    const now = isCron && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(bodySampledAt) ? bodySampledAt : new Date().toISOString();
    const rows = [];
    for (const s of samples) {
        const playerId = String(s.playerId || s.player_id || '');
        if (!/^\d{1,12}$/.test(playerId)) continue;
        const zones = Array.isArray(s.zones) ? s.zones.slice(0, 3).map(Number) : [];
        const total = Number(s.total) || 0;
        // 数值范围校验（防注入超大/负数污染趋势）
        if (zones.length !== 3 || zones.some(v => !Number.isFinite(v) || v < 0 || v > 100000000)) continue;
        if (!Number.isFinite(total) || total < 0 || total > 300000000) continue;
        rows.push({
            week,
            sampled_at: now,
            difficulty,
            player_id: playerId,
            player_name: String(s.name || '').slice(0, 40),
            zones,
            total
        });
    }
    if (rows.length === 0) return res.status(400).json({ error: '无有效采样数据' });

    try {
        const { error } = await supabase
            .from('wz_curve_samples')
            .upsert(rows, { onConflict: 'week,sampled_at,player_id,difficulty', ignoreDuplicates: true });
        if (error) {
            console.error('Trends insert error:', error);
            return res.status(500).json({ error: '入库失败' });
        }
        // 只保留当前周数据（对齐本地换周清空策略），删除其他周 —— 仅限可信 cron 触发，
        // 普通上传者无法再借 week 参数批量清库
        if (isCron) {
            try {
                await supabase.from('wz_curve_samples').delete().neq('week', week);
            } catch (e) {
                console.error('Trends cleanup error:', e.message);
            }
        }
        return res.status(200).json({ status: 'success', count: rows.length });
    } catch (err) {
        console.error('Trends error:', err.message);
        return res.status(500).json({ error: '服务器错误' });
    }
};
