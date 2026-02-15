import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import MessengerView from './views/MessengerView';
import ControlView from './views/ControlView';
import DatingView from './views/DatingView';
import VfxView from './views/VfxView';
import LockScreenView from './views/LockScreenView';
import { DEFAULT_APP_NAME } from './constants';


// Global socket connection
const socket = io();

function App() {
    const [view, setView] = useState('landing');
    const [data, setData] = useState(null); // Full DB state

    // Global poll & socket listener
    useEffect(() => {
        // 1. Socket Init
        socket.on('init', (initialData) => setData(initialData));
        socket.on('data:update', (updatedData) => setData(updatedData));

        // 2. Polling Fallback (Every 1000ms)
        const pollInterval = setInterval(() => {
            fetch('/api/data')
                .then(res => res.json())
                .then(latestData => {
                    if (latestData) setData(latestData);
                })
                .catch(err => console.error("Polling error", err));
        }, 1000);

        return () => {
            socket.off('init');
            socket.off('data:update');
            clearInterval(pollInterval);
        }
    }, []);

    // Simple routing based on URL path
    useEffect(() => {
        const path = window.location.pathname;
        if (path === '/control') {
            setView('control');
        } else if (path === '/app') {
            setView('actor');
        }
    }, []);

    // Dynamically update document title & global background
    useEffect(() => {
        if (data?.datingAppName) {
            document.title = data.datingAppName;
        } else {
            document.title = DEFAULT_APP_NAME;
        }

        // Global Background Control
        // If we are NOT in VFX mode OR Lock Screen mode, ensure the default dark background is set.
        // VFX and Lock Screen handle their own background (or require black).
        if (view === 'actor' && (data?.activeApp === 'vfx' || data?.activeApp === 'lockscreen')) {
            // For VFX and LockScreen, we generally want black body
            document.body.style.backgroundColor = '#000000';
            document.documentElement.style.backgroundColor = '#000000';
            const metaThemeColor = document.querySelector("meta[name='theme-color']");
            if (metaThemeColor) metaThemeColor.setAttribute("content", "#000000");
        } else {
            // Default App Background (Dark Blue)
            document.body.style.backgroundColor = '#0f172a'; // matches var(--bg-dark)
            document.documentElement.style.backgroundColor = '#0f172a';

            // Reset meta theme color to black/dark for non-VFX views
            const metaThemeColor = document.querySelector("meta[name='theme-color']");
            if (metaThemeColor) metaThemeColor.setAttribute("content", "#0f172a");
        }
    }, [data, view]);

    if (!data) return (
        <div style={{
            position: 'fixed', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#0f172a', color: 'white'
        }}>
            Loading...
        </div>
    );

    if (view === 'landing') {
        return (
            <div style={{
                height: '100dvh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '20px'
            }}>
                <h1>{data?.datingAppName || DEFAULT_APP_NAME}</h1>
                <div style={{ display: 'flex', gap: '20px' }}>
                    <button
                        className="control-btn primary"
                        style={{ width: '200px' }}
                        onClick={() => {
                            window.history.pushState({}, '', '/app');
                            setView('actor');
                        }}
                    >
                        Launch Actor App
                    </button>
                    <button
                        className="control-btn"
                        style={{ width: '200px' }}
                        onClick={() => {
                            window.history.pushState({}, '', '/control');
                            setView('control');
                        }}
                    >
                        Open Control Panel
                    </button>
                </div>
            </div>
        );
    }

    // Determine which Actor App to show
    const renderActorApp = () => {
        if (data.activeApp === 'dating') {
            return <DatingView socket={socket} data={data} />;
        }
        if (data.activeApp === 'vfx') {
            return <VfxView data={data} />;
        }
        if (data.activeApp === 'lockscreen') {
            return <LockScreenView data={data} />;
        }
        return <MessengerView socket={socket} data={data} />;
    };

    // Pass socket and global data down
    if (view === 'actor') {
        return renderActorApp();
    }

    return (
        <div className="app-container">
            <ControlView socket={socket} data={data} />
        </div>
    );
}

export default App;
