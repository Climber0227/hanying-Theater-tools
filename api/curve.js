// Vercel Serverless Function: 玩家趋势曲线查询
// GET /api/curve?player=13215355&difficulty=16&week=582
// 返回最近最多 200 条采样：{ status:'success', samples:[{ t, zones, total }] }

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
const supabaseKey = (process.env.SUPABASE_SERVICE_KEY || '').replace(/[\r\n\s]/g, '');
const supabase = createClient(supabaseUrl, supabaseKey);

const MAX_ROWS = 200;

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-store');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const player = String(req.query.player || '').trim();
    const difficulty = String(req.query.difficulty || '').trim();
    const week = parseInt(req.query.week);

    if (!/^\d{1,12}$/.test(player)) return res.status(400).json({ error: 'player 无效' });
    if (!/^\d{1,2}$/.test(difficulty)) return res.status(400).json({ error: 'difficulty 无效' });
    if (!Number.isInteger(week) || week <= 0) return res.status(400).json({ error: 'week 无效' });

    try {
        const { data, error } = await supabase
            .from('wz_curve_samples')
            .select('sampled_at, zones, total')
            .eq('player_id', player)
            .eq('difficulty', difficulty)
            .eq('week', week)
            .order('sampled_at', { ascending: true })
            .limit(MAX_ROWS);
        if (error) {
            console.error('Curve query error:', error);
            return res.status(500).json({ error: '查询失败' });
        }
        const samples = (data || []).map(row => ({
            t: new Date(row.sampled_at).getTime(),
            zones: Array.isArray(row.zones) ? row.zones : [],
            total: row.total != null ? row.total : 0
        }));
        return res.status(200).json({ status: 'success', samples });
    } catch (err) {
        console.error('Curve error:', err.message);
        return res.status(500).json({ error: '服务器错误' });
    }
};
