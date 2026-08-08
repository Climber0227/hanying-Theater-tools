import React, { lazy, Suspense, useCallback, useState } from 'react';
import Nav from './components/Nav.jsx';
import WarzonePage from './components/WarzonePage.jsx';
import AdFloat from './components/AdFloat.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import './styles/app.css';

// 页面懒加载（首屏只加载排行榜核心）
const PlayerPage = lazy(() => import('./components/PlayerPage.jsx'));
const PpcPage = lazy(() => import('./components/PpcPage.jsx'));
const MinePage = lazy(() => import('./components/MinePage.jsx'));
const ChangelogPage = lazy(() => import('./components/ChangelogPage.jsx'));

const PAGE_FALLBACK = <div className="m1-placeholder">加载中…</div>;

export default function App() {
    // 页面状态持久化：URL hash（刷新/分享保留当前页）
    const [page, setPage] = useState(() => {
        const h = window.location.hash.replace(/^#\/?/, '');
        return ['warzone', 'player', 'ppc', 'mine', 'changelog'].includes(h) ? h : 'warzone';
    });
    const [pendingPlayerId, setPendingPlayerId] = useState(null);

    const changePage = useCallback(next => {
        setPage(next);
        try {
            if (next === 'warzone') {
                if (window.location.hash) history.replaceState(null, '', window.location.pathname + window.location.search);
            } else {
                history.replaceState(null, '', `#/${next}`);
            }
        } catch { /* 忽略 */ }
    }, []);

    // 从任意页面打开玩家查询
    const openPlayer = useCallback(id => {
        setPendingPlayerId(String(id));
        changePage('player');
    }, [changePage]);

    return (
        <ErrorBoundary>
            <div className="container">
                <Nav current={page} onChange={changePage} />
                {page === 'warzone' && <WarzonePage onOpenPlayer={openPlayer} />}
                <Suspense fallback={PAGE_FALLBACK}>
                    {page === 'player' && <PlayerPage pendingPlayerId={pendingPlayerId} />}
                    {page === 'ppc' && <PpcPage onOpenPlayer={openPlayer} />}
                    {page === 'mine' && <MinePage />}
                    {page === 'changelog' && <ChangelogPage />}
                </Suspense>
                <AdFloat />
                <a
                    className="corner-feedback"
                    href="https://wpa.qq.com/msgrd?v=3&uin=2813509189&site=qq&menu=yes"
                    target="_blank"
                    rel="noreferrer"
                >
                    反馈bug联系作者QQ：2813509189
                </a>
            </div>
        </ErrorBoundary>
    );
}
