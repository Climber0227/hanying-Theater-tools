// Vercel Serverless Function: 访问计数（全站共享）
// GET /api/visit → 原子自增并返回总访问次数

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
const supabaseKey = (process.env.SUPABASE_SERVICE_KEY || '').replace(/[\r\n\s]/g, '');
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-store');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { data, error } = await supabase.rpc('increment_visit');
        if (error) {
            console.error('Visit counter error:', error);
            return res.status(500).json({ error: '计数失败' });
        }
        return res.status(200).json({ status: 'success', count: data });
    } catch (err) {
        console.error('Visit error:', err.message);
        return res.status(500).json({ error: '服务器错误' });
    }
};
