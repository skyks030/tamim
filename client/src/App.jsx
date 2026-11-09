import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import MessengerView from './views/MessengerView';
import ControlView from './views/ControlView';
import DatingView from './views/DatingView';
import VfxView from './views/VfxView';
import LockScreenView from './views/LockScreenView';
import InstagramView from './views/InstagramView';
import RecorderView from './views/RecorderView';
import { DEFAULT_APP_NAME } from './constants';


// "Mirror" copy used by the Screen Recorder for transparent recordings (/app?mirror=1):
// display-only, never talks to the server, receives its data from the main copy.
const IS_MIRROR = new URLSearchParams(window.location.search).has('mirror');

// Global socket connection
const socket = IS_MIRROR ? io({ autoConnect: false }) : io();
if (IS_MIRROR) socket.emit = () => socket;

// When embedded in the Screen Recorder, hand every data update to it (it forwards to the mirror copy)
const publishToRecorder = (d) => {
    try {
        if (window.parent !== window) window.parent.__recorderOnData?.(d);
    } catch { /* cross-origin parent */ }
};

function App() {
    const [view, setView] = useState('landing');
    const [data, setData] = useState(null); // Full DB state

    // Global poll & socket listener
    useEffect(() => {
        if (IS_MIRROR) {
            window.__setMirrorData = setData;
            try {
                const initial = window.parent?.__recorderGetData?.();
                if (initial) setData(initial);
            } catch { /* no recorder parent */ }
            return () => { delete window.__setMirrorData; };
        }

        const apply = (d) => {
            setData(d);
            publishToRecorder(d);
        };

        // 1. Socket Init
        socket.on('init', apply);
        socket.on('data:update', apply);

        // 2. Polling Fallback (Every 1000ms)
        const pollInterval = setInterval(() => {
            fetch('/api/data')
                .then(res => res.json())
                .then(latestData => {
                    if (latestData) apply(latestData);
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
        } else if (path === '/recorder') {
            setView('recorder');
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
        // VFX, Lock Screen, and Instagram handle their own background (or require black).
        // DatingView manages the body background itself (supports transparent/alpha backgrounds)
        if (view === 'actor' && data?.activeApp === 'dating') return;

        if (view === 'actor' && (data?.activeApp === 'vfx' || data?.activeApp === 'lockscreen' || data?.activeApp === 'instagram')) {
            // For VFX, LockScreen and Instagram we generally want black body
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
                    <button
                        className="control-btn"
                        style={{ width: '200px' }}
                        onClick={() => {
                            window.history.pushState({}, '', '/recorder');
                            setView('recorder');
                        }}
                    >
                        Screen Recorder
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
            return <LockScreenView socket={socket} data={data} />;
        }
        if (data.activeApp === 'instagram') {
            return <InstagramView socket={socket} data={data} />;
        }
        return <MessengerView socket={socket} data={data} />;
    };

    if (view === 'recorder') {
        return <RecorderView socket={socket} data={data} />;
    }

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
