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


// Sandbox mode (/app?sandbox=1) is used by the server-side Screen Recorder to render videos frame by frame.
// It never talks to the server: data is injected, server broadcasts are replayed from the recorded timeline,
// and (for pointer takes) the app's own actions are applied by a local copy of the server logic.
const IS_SANDBOX = new URLSearchParams(window.location.search).has('sandbox');

// Global socket connection
const socket = IS_SANDBOX ? io({ autoConnect: false }) : io();

let sandboxData = IS_SANDBOX ? (window.__TAMIM_SANDBOX__ || null) : null;
let sandboxSetData = null;

function sandboxReduce(d, event, p) {
    if (!d) return null;
    const n = JSON.parse(JSON.stringify(d));
    switch (event) {
        case 'actor:dating_swipe':
            n.activeDatingProfileId = p;
            return n;
        case 'actor:send_message': {
            const chat = n.chats?.find(c => c.id === p?.chatId);
            if (!chat) return null;
            chat.messages.push({ id: Date.now(), text: p.text, sender: 'me' });
            return n;
        }
        case 'control:select_chat':
            n.activeChatId = p;
            return n;
        case 'control:update_lockscreen_settings':
            n.lockScreenSettings = { ...n.lockScreenSettings, ...p };
            return n;
        default:
            return null;
    }
}

if (IS_SANDBOX) {
    socket.emit = (event, payload) => {
        if (window.__TAMIM_SANDBOX_REDUCER__) {
            const next = sandboxReduce(sandboxData, event, payload);
            if (next) { sandboxData = next; sandboxSetData?.(next); }
        }
        return socket;
    };
    // Replays a recorded server broadcast
    window.__tamimServerEvent = (event, payload) => {
        if (event === 'data:update' || event === 'init') {
            sandboxData = payload;
            sandboxSetData?.(payload);
            return;
        }
        (socket.listeners(event) || []).forEach(fn => { try { fn(payload); } catch (e) { console.error(e); } });
    };
}

function App() {
    const [view, setView] = useState('landing');
    const [data, setData] = useState(null); // Full DB state

    // Global poll & socket listener
    useEffect(() => {
        if (IS_SANDBOX) {
            sandboxSetData = setData;
            if (sandboxData) setData(sandboxData);
            return () => { sandboxSetData = null; };
        }

        const apply = (d) => setData(d);

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
