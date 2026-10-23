// WebP 兜底：资源站绝大部分图都有 .webp（体积约为 png 的 1/7），但个别可能缺失。
// 这里用一个全局的 error 捕获（error 事件不冒泡，必须 capture），
// 一旦某张 .webp 加载失败，就把它换成同路径的 .png，且只换一次，避免死循环。
const MARK = 'webpFallbackDone';

export function installImageFallback() {
    if (typeof window === 'undefined' || window.__webpFallbackInstalled) return;
    window.__webpFallbackInstalled = true;

    document.addEventListener(
        'error',
        event => {
            const el = event.target;
            if (!el || el.tagName !== 'IMG') return;
            const src = el.currentSrc || el.src || '';
            // 本地小图（/img/chars/）没有 png 版本，失败就直接放弃，别再打一个 404
            if (src.includes('/img/chars/')) return;
            if (!/\.webp(\?|$)/i.test(src) || el.dataset[MARK] === '1') return;
            el.dataset[MARK] = '1';
            el.src = src.replace(/\.webp(\?|$)/i, '.png');
        },
        true
    );
}
