import { useState, useEffect } from 'react';
import MessengerControl from './MessengerControl';
import DatingControl from './DatingControl';
import VfxControl from './VfxControl';
import LockScreenControl from './LockScreenControl';
import InstagramControl from './InstagramControl';
import { Smartphone, ChevronDown, Check, Save, Edit2, Trash2, RotateCcw } from 'lucide-react';

export default function ControlView({ socket, data }) {
    // Local state for which control panel is visible
    const [currentTab, setCurrentTab] = useState(() => {
        return localStorage.getItem('control_current_tab') || 'messenger';
    });

    // Persist persistence
    useEffect(() => {
        localStorage.setItem('control_current_tab', currentTab);
    }, [currentTab]);



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
                                <option value="vfx">Vfx Screen</option>
                                <option value="lockscreen">Lock Screen</option>
                                <option value="instagram">Instagram</option>
                            </select>
                            <ChevronDown size={16} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', opacity: 0.7 }} />
                        </div>

                        {/* GLOBAL SCENE MANAGER */}
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ position: 'relative' }}>
                                <select
                                    value={data.activeGlobalSceneId || ""}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (val) {
                                            if (confirm("Load this scene? Current unsaved changes will be lost.")) {
                                                socket.emit('control:load_global_scene', val);
                                            }
                                        }
                                    }}
                                    style={{
                                        appearance: 'none',
                                        padding: '0 30px 0 12px', // Reduce vertical padding, rely on height/flex
                                        borderRadius: '8px',
                                        background: 'rgba(255,255,255,0.1)',
                                        color: 'white',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        fontSize: '0.9rem',
                                        width: 180,
                                        cursor: 'pointer',
                                        height: '36px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        boxSizing: 'border-box',
                                        margin: 0
                                    }}
                                >
                                    <option value="" disabled>Load Scene...</option>
                                    {(data.globalScenes || []).map(s => (
                                        <option key={s.id} value={s.id}>
                                            {s.name}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown size={14} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', opacity: 0.7 }} />
                            </div>

                            <button className="control-btn secondary"
                                style={{
                                    width: 'auto',
                                    padding: '0 10px',
                                    height: '36px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    margin: 0,
                                    boxSizing: 'border-box'
                                }}
                                title="Save Current Scene"
                                onClick={() => {
                                    const name = prompt("Name for new scene:", `Scene ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
                                    if (name) socket.emit('control:save_global_scene', name);
                                }}
                            >
                                <Save size={16} />
                            </button>

                            {/* Actions for Active Scene if selected */}
                            {data.activeGlobalSceneId && (
                                <>
                                    <button className="control-btn secondary" style={{
                                        width: 'auto',
                                        padding: '0 10px',
                                        height: '36px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        margin: 0,
                                        boxSizing: 'border-box'
                                    }} title="Reset Scene to Saved State"
                                        onClick={() => {
                                            if (confirm("Reset scene to saved state? Unsaved changes will be lost.")) {
                                                socket.emit('control:load_global_scene', data.activeGlobalSceneId);
                                            }
                                        }}
                                    >
                                        <RotateCcw size={16} />
                                    </button>
                                    <button className="control-btn secondary" style={{
                                        width: 'auto',
                                        padding: '0 10px',
                                        height: '36px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        margin: 0,
                                        boxSizing: 'border-box'
                                    }} title="Rename Current Scene"
                                        onClick={() => {
                                            const s = data.globalScenes?.find(x => x.id === data.activeGlobalSceneId);
                                            if (s) {
                                                const newName = prompt("Rename scene:", s.name);
                                                if (newName) socket.emit('control:rename_global_scene', { sceneId: s.id, name: newName });
                                            }
                                        }}
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button className="control-btn danger" style={{
                                        width: 'auto',
                                        padding: '0 10px',
                                        height: '36px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        margin: 0,
                                        boxSizing: 'border-box'
                                    }} title="Delete Current Scene"
                                        onClick={() => {
                                            if (confirm("Delete this scene?")) {
                                                socket.emit('control:delete_global_scene', data.activeGlobalSceneId);
                                            }
                                        }}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </>
                            )}
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


                </div>

                {/* CONTENT AREA */}
                {currentTab === 'messenger' && <MessengerControl socket={socket} data={data} />}

                {currentTab === 'dating' && <DatingControl socket={socket} data={data} />}

                {currentTab === 'vfx' && <VfxControl socket={socket} data={data} />}

                {currentTab === 'lockscreen' && <LockScreenControl socket={socket} data={data} />}

                {currentTab === 'instagram' && <InstagramControl socket={socket} data={data} />}

            </div>
        </div>
    );
}
