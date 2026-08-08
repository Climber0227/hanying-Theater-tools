import React, { useEffect, useRef, useState } from 'react';

// 纷争战区宣传广告：随机漂动，鼠标悬停暂停，可关闭
// 关闭状态存 sessionStorage：进入网站关一次，本次会话内（含切页/刷新）不再弹出
const AD_CLOSED_KEY = 'huaxu_ad_closed';

export default function AdFloat() {
    const [visible, setVisible] = useState(() => !sessionStorage.getItem(AD_CLOSED_KEY));
    const adRef = useRef(null);
    const timerRef = useRef(null);
    const flyingRef = useRef(true);

    useEffect(() => {
        const ad = adRef.current;
        if (!ad) return;
        const move = () => {
            if (!flyingRef.current) return;
            const w = ad.offsetWidth || 340;
            const h = ad.offsetHeight || 300;
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const maxX = Math.max(vw - w - 16, 16);
            const maxY = Math.max(vh - h - 16, 16);
            ad.style.left = `${16 + Math.random() * Math.max(maxX - 16, 1)}px`;
            ad.style.top = `${16 + Math.random() * Math.max(maxY - 16, 1)}px`;
        };
        ad.style.left = '16px';
        ad.style.top = '16px';
        timerRef.current = setInterval(move, 2500);
        return () => clearInterval(timerRef.current);
    }, []);

    if (!visible) return null;

    return (
        <div
            ref={adRef}
            className="ad-float"
            onMouseEnter={() => {
                flyingRef.current = false;
                clearInterval(timerRef.current);
            }}
            onMouseLeave={() => {
                if (timerRef.current) clearInterval(timerRef.current);
                timerRef.current = setInterval(() => {
                    const ad = adRef.current;
                    if (!ad || !flyingRef.current) return;
                    const w = ad.offsetWidth || 340;
                    const h = ad.offsetHeight || 300;
                    const vw = window.innerWidth;
                    const vh = window.innerHeight;
                    const maxX = Math.max(vw - w - 16, 16);
                    const maxY = Math.max(vh - h - 16, 16);
                    ad.style.left = `${16 + Math.random() * Math.max(maxX - 16, 1)}px`;
                    ad.style.top = `${16 + Math.random() * Math.max(maxY - 16, 1)}px`;
                }, 2500);
                flyingRef.current = true;
            }}
        >
            <button
                className="ad-close"
                title="关闭"
                onClick={e => {
                    e.stopPropagation();
                    clearInterval(timerRef.current);
                    try { sessionStorage.setItem(AD_CLOSED_KEY, '1'); } catch { /* 隐私模式忽略 */ }
                    setVisible(false);
                }}
            >
                &times;
            </button>
            <img src="/img/Snipaste_2026-08-04_00-46-56.png" alt="纷争战区" draggable="false" />
        </div>
    );
}
