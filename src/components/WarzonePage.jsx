import React from 'react';
import { useWarzone } from '../hooks/useWarzone.js';
import ZoneCards from './ZoneCards.jsx';
import RankingPanel from './Ranking/RankingPanel.jsx';

export default function WarzonePage() {
    const warzone = useWarzone();
    return (
        <>
            <ZoneCards zones={warzone.zones} />
            <RankingPanel warzone={warzone} />
        </>
    );
}
