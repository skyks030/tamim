import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/main.css'

// Prevent browser from restoring scroll position on reload, which causes jumps
if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
}

// Dynamic Viewport Height Fix for Mobile
const setAppHeight = () => {
    const doc = document.documentElement;
    doc.style.setProperty('--app-height', `${window.innerHeight}px`);
};
setAppHeight();
window.addEventListener('resize', setAppHeight);

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)
