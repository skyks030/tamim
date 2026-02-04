import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import ActorView from './views/ActorView';
import ControlView from './views/ControlView';

// Global socket connection
const socket = io();

function App() {
    const [view, setView] = useState('landing');
    const [data, setData] = useState(null); // Full DB state

    // Global socket listener for data updates
    useEffect(() => {
        socket.on('init', (initialData) => setData(initialData));
        socket.on('data:update', (updatedData) => setData(updatedData));

        // Also listen for force-switch events from control
        socket.on('actor:switch_chat', (chatId) => {
            // logic handled inside ActorView mostly, or we update global "activeChatId" in data
            // But if we are in actor mode, we might want to ensure we are up to date.
            // The 'data:update' will effectively handle the activeChatId change.
        });

        return () => {
            socket.off('init');
            socket.off('data:update');
            socket.off('actor:switch_chat');
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
                <h1>Spark Demo</h1>
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

    // Pass socket and global data down
    return (
        <div className="app-container">
            {view === 'actor'
                ? <ActorView socket={socket} data={data} />
                : <ControlView socket={socket} data={data} />
            }
        </div>
    );
}

export default App;
