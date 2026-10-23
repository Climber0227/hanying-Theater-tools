import React, { useEffect, useRef, useState } from 'react';

// 1×1 透明占位，避免 <img> 没有 src 时出现破图边框
const BLANK =
    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxIiBoZWlnaHQ9IjEiLz4=';

// 视口感知的图片：进入（或接近）视口才真正赋 src。
// 玩家页一次渲染 85 个角色图标，每个约 148KB（1024×1024 原图缩到 48px 显示），
// 原生 loading="lazy" 在 Chromium 里阈值 1250px，几乎等于全部立即加载；
// 这里用 IntersectionObserver 把首屏之外的请求省掉。
export default function LazyImage({
    src,
    alt = '',
    className,
    width,
    height,
    style,
    onError,
    rootMargin = '300px',
    ...rest
}) {
    const ref = useRef(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (visible || !src) return;
        const el = ref.current;
        if (!el) return;
        if (typeof IntersectionObserver === 'undefined') {
            setVisible(true);
            return;
        }
        const io = new IntersectionObserver(
            entries => {
                if (entries.some(e => e.isIntersecting)) {
                    setVisible(true);
                    io.disconnect();
                }
            },
            { rootMargin }
        );
        io.observe(el);
        return () => io.disconnect();
    }, [visible, src, rootMargin]);

    return (
        <img
            ref={ref}
            className={className}
            src={visible ? src : BLANK}
            data-src={src}
            alt={alt}
            width={width}
            height={height}
            style={style}
            decoding="async"
            onError={onError}
            {...rest}
        />
    );
}
