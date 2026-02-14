import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import ActorView from './views/ActorView';
import ControlView from './views/ControlView';
import DatingView from './views/DatingView';
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

    // Dynamically update document title
    useEffect(() => {
        if (data?.datingAppName) {
            document.title = data.datingAppName;
        } else {
            document.title = DEFAULT_APP_NAME;
        }
    }, [data]);

    if (!data) return <div style={{ color: 'white', padding: 20 }}>Loading...</div>;

    if (view === 'landing') {
        return (
            <div style={{
                height: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '20px'
            }}>
                <h1>{data?.datingAppName || DEFAULT_APP_NAME} Demo</h1>
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
        return <ActorView socket={socket} data={data} />;
    };

    // Pass socket and global data down
    return (
        <div className="app-container">
            {view === 'actor'
                ? renderActorApp()
                : <ControlView socket={socket} data={data} />
            }
        </div>
    );
}

export default App;
