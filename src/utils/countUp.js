import { useEffect, useRef, useState } from 'react';

// 数字就位动画：挂载/数值变化时从旧值平滑滚动到新值（ease-out cubic，~700ms）
// 用法：const v = useCountUp(target); 组件内 formatNumber(v) 显示
export function useCountUp(target, duration = 700) {
    const [value, setValue] = useState(0);
    const fromRef = useRef(0);

    useEffect(() => {
        const from = fromRef.current;
        if (from === target) return;
        const start = performance.now();
        let raf;
        const tick = now => {
            const t = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - t, 3);
            const v = from + (target - from) * eased;
            setValue(Math.round(v));
            if (t < 1) {
                raf = requestAnimationFrame(tick);
            } else {
                fromRef.current = target;
            }
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [target, duration]);

    return value;
}
