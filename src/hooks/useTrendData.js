import { useMemo } from 'react';
import { getMondayStart } from '../utils/format.js';

// 本周按时采样（多次同步的时间序列）
const TODAY_SAMPLES_KEY = 'my_wz_today_samples';

// 我的页趋势数据：今日按时 + 本周按天（与 MyTrendSection 共用，供弹窗复用）
export function useTrendData(zones, syncStamp) {
    const weekSamples = useMemo(() => {
        try {
            const raw = JSON.parse(localStorage.getItem(TODAY_SAMPLES_KEY)) || [];
            const monday = getMondayStart();
            return raw.filter(s => s.t >= monday && s.total > 0).sort((a, b) => a.t - b.t);
        } catch { return []; }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [syncStamp]);

    const zoneList = useMemo(() => zones.map((z, i) => ({ id: i, name: z.name })), [zones]);

    const { todayData, dayData, hasToday, hasWeek } = useMemo(() => {
        const monday = getMondayStart();

        const toRow = (s, i) => ({
            _i: i, time: s.t,
            z0: (s.zones && s.zones[0]) || null,
            z1: (s.zones && s.zones[1]) || null,
            z2: (s.zones && s.zones[2]) || null,
            total: s.total
        });
        const emptyRow = t => ({ _i: 0, time: t, z0: 0, z1: 0, z2: 0, total: 0 });

        // 今日按时：0 点→现在按小时补点（首次同步前=0，之后缺失延续最新）
        const now = Date.now();
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayData = [];
        let lastKnown = null;
        for (let h = 0; ; h++) {
            const t = todayStart.getTime() + h * 3600000;
            if (t > now) break;
            const match = weekSamples.find(s => s.t >= t && s.t < t + 3600000);
            if (match) lastKnown = match;
            if (lastKnown) {
                const row = toRow(lastKnown, h);
                row.time = t;
                todayData.push(row);
            } else {
                todayData.push(emptyRow(t));
            }
        }
        const hasToday = todayData.length >= 2 && todayData.some(d => d.total > 0);

        // 本周按天：周一~周日 7 点（首次同步日前=0，之后缺失延续）
        const byDay = {};
        weekSamples.forEach(s => {
            const d = new Date(s.t);
            const dayKey = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
            byDay[dayKey] = s;
        });
        const dayData = [];
        let lastDayKnown = null;
        for (let i = 0; i < 7; i++) {
            const dayStart = monday + i * 86400000;
            const s = byDay[dayStart];
            if (s) lastDayKnown = s;
            if (lastDayKnown) {
                const row = toRow(lastDayKnown, i);
                row.time = dayStart;
                dayData.push(row);
            } else {
                dayData.push(emptyRow(dayStart));
            }
        }
        const hasWeek = dayData.some(d => d.total > 0);

        return { todayData, dayData, hasToday, hasWeek };
    }, [weekSamples]);

    return { todayData, dayData, hasToday, hasWeek, zoneList };
}
