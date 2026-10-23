import React, { useCallback, useEffect, useRef, useState } from 'react';

// 纷争战区宣传广告：随机漂动，鼠标悬停暂停，可关闭
// 关闭状态存 sessionStorage：进入网站关一次，本次会话内（含切页/刷新）不再自动弹出
// 关闭后左下角保留「攻略图」按钮，可随时手动打开（打开后清除关闭标记）
const AD_CLOSED_KEY = 'huaxu_ad_closed';

export default function AdFloat() {
    const [visible, setVisible] = useState(() => !sessionStorage.getItem(AD_CLOSED_KEY));
    const adRef = useRef(null);
    const timerRef = useRef(null);
    const flyingRef = useRef(true);

    // 漂动逻辑：visible 变化时重新绑定，关闭再打开后继续漂
    useEffect(() => {
        if (!visible) return;
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
        flyingRef.current = true;
        timerRef.current = setInterval(move, 2500);
        return () => clearInterval(timerRef.current);
    }, [visible]);

    const closeAd = useCallback(() => {
        clearInterval(timerRef.current);
        try { sessionStorage.setItem(AD_CLOSED_KEY, '1'); } catch { /* 隐私模式忽略 */ }
        setVisible(false);
    }, []);

    const openAd = useCallback(() => {
        try { sessionStorage.removeItem(AD_CLOSED_KEY); } catch { /* 忽略 */ }
        setVisible(true);
    }, []);

    return (
        <>
            {visible && (
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
                            closeAd();
                        }}
                    >
                        &times;
                    </button>
                    {/* 只换图片编码（1.34MB PNG → 138KB WebP），画面与原图一致 */}
                    <img
                        src="/img/ad-warzone.webp"
                        alt="纷争战区"
                        draggable="false"
                        width="340"
                        height="303"
                        decoding="async"
                    />
                </div>
            )}

            {!visible && (
                <button className="ad-reopen" onClick={openAd} title="打开战区攻略图" aria-label="打开战区攻略图">
                    <span className="ad-reopen-dot" />
                    攻略图
                </button>
            )}
        </>
    );
}
