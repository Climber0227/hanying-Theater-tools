import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { installImageFallback } from './api/imageFallback.js';
import './styles/theme.css';
import './styles/app.css';
import './styles/ranking.css';
import './styles/zone.css';
import './styles/modals.css';
import './styles/pages.css';

installImageFallback();

const boot = document.getElementById('boot');

// 撤掉 index.html 里的首屏加载页：等 React 真正画出第一帧，再淡出，避免「加载页没了但内容还没出来」的空窗。
function dismissBoot() {
    if (!boot || boot.dataset.done === '1') return;
    boot.dataset.done = '1';
    (window.__bootTimers || []).forEach(clearTimeout);
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            boot.classList.add('is-done');
            setTimeout(() => boot.remove(), 320);
        });
    });
}

try {
    createRoot(document.getElementById('root')).render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );
    dismissBoot();
} catch (error) {
    // 挂载失败时别留一个永远转圈的画面，至少给一句能操作的提示
    const tip = document.getElementById('boot-tip');
    if (tip) {
        tip.textContent = '页面初始化失败，请刷新重试';
        tip.classList.remove('boot-dots');
    }
    console.error(error);
}
