import React, { useState, useEffect } from 'react';
import Nav from './components/Nav.jsx';
import WarzonePage from './components/WarzonePage.jsx';
import PlayerPage from './components/PlayerPage.jsx';
import PpcPage from './components/PpcPage.jsx';
import MinePage from './components/MinePage.jsx';
import AdFloat from './components/AdFloat.jsx';
import './styles/app.css';

export default function App() {
    const [page, setPage] = useState('warzone');

    return (
        <div className="container">
            <Nav current={page} onChange={setPage} />
            {page === 'warzone' && <WarzonePage />}
            {page === 'player' && <PlayerPage />}
            {page === 'ppc' && <PpcPage />}
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
