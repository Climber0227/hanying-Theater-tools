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

createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
