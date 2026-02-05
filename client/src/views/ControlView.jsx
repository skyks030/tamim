import { useState, useEffect } from 'react';
import MessengerControl from './MessengerControl';
import DatingControl from './DatingControl';
import { Smartphone, ChevronDown, Check } from 'lucide-react';

export default function ControlView({ socket, data }) {
    // Local state for which control panel is visible
    const [currentTab, setCurrentTab] = useState(() => {
        return localStorage.getItem('control_current_tab') || 'messenger';
    });

    // Persist persistence
    useEffect(() => {
        localStorage.setItem('control_current_tab', currentTab);
    }, [currentTab]);

    const { activeApp } = data;

    const handleSwitchPhoneApp = () => {
        socket.emit('control:switch_app', currentTab);
    };

    const isLive = activeApp === currentTab;

    return (
        <div style={{ height: '100%', overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '20px' }}>
            <div className="control-panel" style={{ maxWidth: '1200px', margin: '0 auto', minHeight: 'calc(100% + 1px)' }}>

                {/* HEADER & APP SWITCHER */}
                <div className="glass" style={{ padding: '15px 20px', borderRadius: '16px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                        <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Control Center</h2>

                        {/* Dropdown Menu */}
                        <div style={{ position: 'relative' }}>
                            <select
                                value={currentTab}
                                onChange={(e) => setCurrentTab(e.target.value)}
                                style={{
                                    appearance: 'none',
                                    padding: '8px 40px 8px 16px',
                                    borderRadius: '12px',
                                    background: 'rgba(0,0,0,0.3)',
                                    color: 'white',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    fontSize: '1rem',
                                    fontWeight: 'bold',
                                    fontFamily: 'inherit',
                                    cursor: 'pointer',
                                    outline: 'none'
                                }}
                            >
                                <option value="messenger">Messenger</option>
                                <option value="dating">Dating App</option>
                            </select>
                            <ChevronDown size={16} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', opacity: 0.7 }} />
                        </div>

                        {/* Connection Status */}
                        <div style={{
                            padding: '4px 12px',
                            borderRadius: '20px',
                            background: socket.connected ? '#10b981' : '#ef4444',
                            fontSize: '0.8rem',
                            fontWeight: 'bold'
                        }}>
                            {socket.connected ? 'CONNECTED' : 'DISCONNECTED'}
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
                        {/* Go Live Button */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: '0.8rem', color: '#aaa' }}>Phone: <strong style={{ color: 'white' }}>{activeApp === 'dating' ? 'Tinder' : 'Messenger'}</strong></span>

                            <button
                                className={`control-btn ${isLive ? 'success' : 'primary'}`}
                                style={{
                                    marginBottom: 0,
                                    width: 'auto',
                                    padding: '8px 20px',
                                    fontSize: '0.9rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    opacity: isLive ? 1 : 1,
                                    background: isLive ? '#22c55e' : undefined, // Explicit Green when live if not covered by class
                                    border: isLive ? '1px solid #22c55e' : undefined
                                }}
                                onClick={handleSwitchPhoneApp}
                                disabled={isLive}
                            >
                                {isLive ? (
                                    <>
                                        <Check size={16} /> Live on Phone
                                    </>
                                ) : (
                                    <>
                                        <Smartphone size={16} /> Go Live
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* CONTENT AREA */}
                {currentTab === 'messenger' && <MessengerControl socket={socket} data={data} />}

                {currentTab === 'dating' && <DatingControl socket={socket} data={data} />}

            </div>
        </div>
    );
}
