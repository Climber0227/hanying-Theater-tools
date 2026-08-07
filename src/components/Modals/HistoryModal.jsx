import React, { useEffect, useRef, useState } from 'react';
import Modal from './Modal.jsx';
import { API_CONFIG } from '../../api/config.js';
import { formatNumber } from '../../utils/format.js';

// 历史战绩：从最新往前查近100周该玩家上榜记录（可取消）
export default function HistoryModal({ playerId, playerName, difficulty, weekOptions, onClose }) {
    const [rows, setRows] = useState([]);
    const [progress, setProgress] = useState('');
    const [searching, setSearching] = useState(false);
    const cancelledRef = useRef(false);

    useEffect(() => {
        cancelledRef.current = false;
        let mounted = true;

        (async () => {
            if (!weekOptions.min || !weekOptions.max) {
                if (mounted) setProgress('请先加载战区数据');
                return;
            }
            setSearching(true);
            setProgress('正在查询历史战绩...');
            const results = [];
            const startWeek = weekOptions.max;
            const endWeek = Math.max(weekOptions.min, weekOptions.max - 99);
            const BATCH = 5; // 并发批次
            let idx = 0;

            for (let w = startWeek; w >= endWeek; w -= BATCH) {
                if (cancelledRef.current || !mounted) break;
                const weeks = [];
                for (let k = 0; k < BATCH && w - k >= endWeek; k++) weeks.push(w - k);
                idx += weeks.length;
                if (mounted) setProgress(`查询中... 已查 ${idx} 周 (${weeks[weeks.length - 1]}-${weeks[0]})`);
                const responses = await Promise.all(weeks.map(week =>
                    fetch(`${API_CONFIG.warzone}/${week}/${difficulty}`, {
                        headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
                    }).then(r => r.json()).catch(() => null)
                ));
                if (cancelledRef.current || !mounted) break;
                responses.forEach((result, i) => {
                    if (result && result.status === 'success' && result.data && result.data.rankings) {
                        const found = result.data.rankings.find(r => r && r.player && String(r.player.id) === String(playerId));
                        if (found) {
                            results.push({ week: weeks[i], rank: found.rank, score: found.score });
                        }
                    }
                });
                await new Promise(r => setTimeout(r, 150));
            }

            if (!mounted) return;
            setSearching(false);
            if (cancelledRef.current) return;
            setRows(results);
            setProgress(`共找到 ${results.length} 周上榜记录`);
        })();

        return () => {
            mounted = false;
            cancelledRef.current = true;
        };
    }, [playerId, difficulty, weekOptions]);

    return (
        <Modal title={`${playerName} 历史战绩`} sub={`(第${difficulty}段位)`} onClose={onClose}>
            {searching && <div className="history-loading">{progress}</div>}
            {!searching && <div className="history-sub" style={{ marginBottom: 10 }}>{progress}</div>}
            {!searching && rows.length > 0 && (
                <table className="score-table">
                    <thead>
                        <tr><th>周数</th><th>排名</th><th>总分</th></tr>
                    </thead>
                    <tbody>
                        {rows.map(r => (
                            <tr key={r.week}>
                                <td>第{r.week}周</td>
                                <td><span className={r.rank <= 3 ? 'rank-delta-up' : ''} style={{ fontWeight: 700 }}>{r.rank}</span></td>
                                <td>{formatNumber(r.score)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
            {!searching && rows.length === 0 && <div className="history-empty">该玩家近100周无上榜记录</div>}
        </Modal>
    );
}
