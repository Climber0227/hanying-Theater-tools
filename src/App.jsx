import React, { useState } from 'react';
import Nav from './components/Nav.jsx';
import WarzonePage from './components/WarzonePage.jsx';
import PlayerPage from './components/PlayerPage.jsx';
import PpcPage from './components/PpcPage.jsx';
import MinePage from './components/MinePage.jsx';
import AdFloat from './components/AdFloat.jsx';
import './styles/app.css';

export default function App() {
    const [page, setPage] = useState('warzone');
    const [pendingPlayerId, setPendingPlayerId] = useState(null);

    // 从任意页面打开玩家查询
    const openPlayer = id => {
        setPendingPlayerId(String(id));
        setPage('player');
    };

    return (
        <div className="container">
            <Nav current={page} onChange={setPage} />
            {page === 'warzone' && <WarzonePage onOpenPlayer={openPlayer} />}
            {page === 'player' && <PlayerPage pendingPlayerId={pendingPlayerId} />}
            {page === 'ppc' && <PpcPage onOpenPlayer={openPlayer} />}
            {page === 'mine' && <MinePage />}
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
    );
}
