import React, { useRef } from 'react';
import { Upload, X, Clock, Calendar, Smartphone, Camera, Flashlight as FlashlightIcon, Image as ImageIcon, Trash2, ChevronUp, ChevronDown, Plus } from 'lucide-react';
import axios from 'axios';

export default function LockScreenControl({ socket, data }) {
    const { lockScreenSettings } = data;
    const fileInputRef = useRef(null);
    const callFileInputRef = useRef(null);

    if (!lockScreenSettings) return <div>Loading...</div>;

    const updateSettings = (updates) => {
        socket.emit('control:update_lockscreen_settings', updates);
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);
        formData.append('purpose', 'lockscreen-bg');

        try {
            await axios.post('/api/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            // Update happens via socket from server
        } catch (err) {
            console.error("Upload failed", err);
            alert("Upload failed");
        }
    };

    const clearBackground = () => {
        if (confirm("Remove background image?")) {
            socket.emit('control:clear_avatar', { purpose: 'lockscreen-bg' });
        }
    };

    const handleCallFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);
        formData.append('purpose', 'lockscreen-call-bg');

        try {
            await axios.post('/api/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
        } catch (err) {
            console.error("Upload failed", err);
            alert("Upload failed");
        }
    };

    const clearCallBackground = () => {
        if (confirm("Remove call background image?")) {
            socket.emit('control:clear_avatar', { purpose: 'lockscreen-call-bg' });
        }
    };

    // --- Notifications Logic ---
    const notifications = lockScreenSettings.notifications || [];

    const handleAddNotification = () => {
        const newNotif = {
            id: Date.now().toString(),
            sender: 'Nachrichten',
            message: 'Neue Nachricht erhalten.',
            time: 'Jetzt'
        };
        updateSettings({ notifications: [...notifications, newNotif] });
    };

    const handleUpdateNotification = (id, field, value) => {
        const updated = notifications.map(notif =>
            notif.id === id ? { ...notif, [field]: value } : notif
        );
        updateSettings({ notifications: updated });
    };

    const handleDeleteNotification = (id) => {
        const updated = notifications.filter(notif => notif.id !== id);
        updateSettings({ notifications: updated });
    };

    const handleMoveNotification = (index, direction) => {
        if ((direction === -1 && index === 0) || (direction === 1 && index === notifications.length - 1)) return;

        const updated = [...notifications];
        const temp = updated[index];
        updated[index] = updated[index + direction];
        updated[index + direction] = temp;

        updateSettings({ notifications: updated });
    };


    return (
        <div className="control-section" style={{ maxWidth: '900px', margin: '0 auto' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Smartphone size={24} /> Lock Screen Control
            </h2>

            {/* Global Actions Selection */}
            <div className="card glass" style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                    <h3 style={{ margin: 0 }}>Screen Mode</h3>
                    <button
                        className={`control-btn ${data.activeApp === 'lockscreen' ? 'primary' : 'success'}`}
                        style={{ width: 'auto', marginBottom: 0 }}
                        disabled={data.activeApp === 'lockscreen'}
                        onClick={() => socket.emit('control:switch_app', 'lockscreen')}
                    >
                        {data.activeApp === 'lockscreen' ? 'Active on Screen' : 'Show on Screen'}
                    </button>
                </div>
                <div style={{ display: 'flex', gap: '15px' }}>
                    <button
                        className={`control-btn ${lockScreenSettings.mode === 'black' ? 'primary' : ''}`}
                        onClick={() => {
                            const newMode = lockScreenSettings.mode === 'black' ? 'lock' : 'black';
                            const updates = { mode: newMode };
                            if (newMode === 'black') {
                                updates.showCall = false; // Close call when turning off screen
                            }
                            updateSettings(updates);
                        }}
                        style={{ flex: 1, padding: '15px', fontSize: '1.2rem', fontWeight: 'bold', marginBottom: 0 }}
                    >
                        Turn Display Off
                    </button>
                    <button
                        className={`control-btn ${lockScreenSettings.showCall ? 'success' : 'danger'}`}
                        onClick={() => {
                            const newShowCall = !lockScreenSettings.showCall;
                            const updates = { showCall: newShowCall };
                            // If we are turning it ON, forcefully wake the screen to lock mode:
                            if (newShowCall) {
                                updates.mode = 'lock';
                            }
                            updateSettings(updates);
                        }}
                        style={{
                            flex: 1, padding: '15px', fontSize: '1.2rem', fontWeight: 'bold', marginBottom: 0,
                            background: lockScreenSettings.showCall ? 'rgba(74, 222, 128, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                            borderColor: lockScreenSettings.showCall ? '#4ade80' : '#ef4444'
                        }}
                    >
                        {lockScreenSettings.showCall ? 'End Call Overlay' : 'Trigger Call Overlay'}
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '20px', alignItems: 'start' }}>
                {/* LEFT COLUMN: LOCKSCREEN SETTINGS */}
                <div>
                    {/* Elements Toggles */}
                    <div className="card glass" style={{ marginBottom: '20px' }}>
                        <h3>Lockscreen Elements</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '8px' }}>
                            <button
                                className="control-btn"
                                onClick={() => updateSettings({ showTime: lockScreenSettings.showTime === false })}
                                style={{
                                    padding: '8px', fontSize: '0.85rem', marginBottom: 0,
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5,
                                    background: lockScreenSettings.showTime !== false ? 'rgba(74, 222, 128, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                    borderColor: lockScreenSettings.showTime !== false ? '#4ade80' : '#ef4444'
                                }}
                            >
                                <Clock size={16} /> <span>Time</span>
                            </button>
                            <button
                                className="control-btn"
                                onClick={() => updateSettings({ showDate: lockScreenSettings.showDate === false })}
                                style={{
                                    padding: '8px', fontSize: '0.85rem', marginBottom: 0,
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5,
                                    background: lockScreenSettings.showDate !== false ? 'rgba(74, 222, 128, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                    borderColor: lockScreenSettings.showDate !== false ? '#4ade80' : '#ef4444'
                                }}
                            >
                                <Calendar size={16} /> <span>Date</span>
                            </button>
                            <button
                                className="control-btn"
                                onClick={() => updateSettings({ showFlashlight: lockScreenSettings.showFlashlight === false })}
                                style={{
                                    padding: '8px', fontSize: '0.85rem', marginBottom: 0,
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5,
                                    background: lockScreenSettings.showFlashlight !== false ? 'rgba(74, 222, 128, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                    borderColor: lockScreenSettings.showFlashlight !== false ? '#4ade80' : '#ef4444'
                                }}
                            >
                                <FlashlightIcon size={16} /> <span>Flashlight</span>
                            </button>
                            <button
                                className="control-btn"
                                onClick={() => updateSettings({ showCamera: lockScreenSettings.showCamera === false })}
                                style={{
                                    padding: '8px', fontSize: '0.85rem', marginBottom: 0,
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5,
                                    background: lockScreenSettings.showCamera !== false ? 'rgba(74, 222, 128, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                    borderColor: lockScreenSettings.showCamera !== false ? '#4ade80' : '#ef4444'
                                }}
                            >
                                <Camera size={16} /> <span>Camera</span>
                            </button>
                            <button
                                className="control-btn"
                                onClick={() => updateSettings({ showHomeBar: lockScreenSettings.showHomeBar === false })}
                                style={{
                                    padding: '8px', fontSize: '0.85rem', marginBottom: 0,
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5,
                                    background: lockScreenSettings.showHomeBar !== false ? 'rgba(74, 222, 128, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                    borderColor: lockScreenSettings.showHomeBar !== false ? '#4ade80' : '#ef4444'
                                }}
                            >
                                <div style={{ width: 16, height: 2, background: 'currentColor', borderRadius: 2 }} /> <span>Home Bar</span>
                            </button>
                        </div>

                        {/* Position Offset Slider */}
                        <div style={{ marginTop: '20px' }}>
                            <label style={{ display: 'block', marginBottom: 5, fontSize: '0.9rem' }}>Time/Date Vertical Position</label>
                            <input
                                type="range"
                                min="0"
                                max="300"
                                step="5"
                                value={lockScreenSettings.timeOffset ?? 60}
                                onChange={(e) => updateSettings({ timeOffset: parseInt(e.target.value) })}
                                style={{ width: '100%' }}
                            />
                        </div>
                    </div>

                    {/* Notifications Manager */}
                    <div className="card glass" style={{ marginBottom: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <h3 style={{ margin: 0 }}>Notifications</h3>
                            <button className="control-btn success" onClick={handleAddNotification} style={{ padding: '5px 10px', fontSize: '0.9rem', marginBottom: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
                                <Plus size={16} /> Add
                            </button>
                        </div>

                        {notifications.length === 0 ? (
                            <p style={{ fontSize: '0.9rem', opacity: 0.6, textAlign: 'center', margin: '20px 0' }}>No notifications added.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                {notifications.map((notif, idx) => (
                                    <div key={notif.id} style={{
                                        padding: '10px',
                                        borderRadius: '8px',
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        border: '1px solid rgba(255, 255, 255, 0.1)'
                                    }}>
                                        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                                            <div style={{ display: 'flex', gap: '10px', flex: 1 }}>
                                                <input
                                                    type="text"
                                                    className="input-field"
                                                    placeholder="Sender"
                                                    value={notif.sender}
                                                    onChange={(e) => handleUpdateNotification(notif.id, 'sender', e.target.value)}
                                                    style={{ flex: 2, margin: 0 }}
                                                />
                                                <input
                                                    type="text"
                                                    className="input-field"
                                                    placeholder="Time (e.g. 'Jetzt' or '09:41')"
                                                    value={notif.time}
                                                    onChange={(e) => handleUpdateNotification(notif.id, 'time', e.target.value)}
                                                    style={{ flex: 1, margin: 0 }}
                                                />
                                            </div>
                                            <div style={{ display: 'flex', gap: '5px' }}>
                                                <button
                                                    className="control-btn"
                                                    onClick={() => handleMoveNotification(idx, -1)}
                                                    disabled={idx === 0}
                                                    style={{ padding: '8px', marginBottom: 0, opacity: idx === 0 ? 0.3 : 1 }}
                                                ><ChevronUp size={16} /></button>
                                                <button
                                                    className="control-btn"
                                                    onClick={() => handleMoveNotification(idx, 1)}
                                                    disabled={idx === notifications.length - 1}
                                                    style={{ padding: '8px', marginBottom: 0, opacity: idx === notifications.length - 1 ? 0.3 : 1 }}
                                                ><ChevronDown size={16} /></button>
                                                <button
                                                    className="control-btn danger"
                                                    onClick={() => handleDeleteNotification(notif.id)}
                                                    style={{ padding: '8px', marginBottom: 0 }}
                                                ><Trash2 size={16} /></button>
                                            </div>
                                        </div>

                                        <textarea
                                            className="input-field"
                                            placeholder="Message Text"
                                            value={notif.message}
                                            onChange={(e) => handleUpdateNotification(notif.id, 'message', e.target.value)}
                                            style={{ width: '100%', marginBottom: 0, resize: 'vertical', minHeight: '60px' }}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Custom Text / Overrides */}
                    <div className="card glass" style={{ marginBottom: '20px' }}>
                        <h3>Overrides (Optional)</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: 5, fontSize: '0.9rem' }}>Custom Time (e.g. 09:41)</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="Leave empty for Real Time"
                                    value={lockScreenSettings.customTime || ''}
                                    onChange={(e) => updateSettings({ customTime: e.target.value })}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: 5, fontSize: '0.9rem' }}>Custom Date</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="Leave empty for Real Date"
                                    value={lockScreenSettings.customDate || ''}
                                    onChange={(e) => updateSettings({ customDate: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Background Settings */}
                    <div className="card glass">
                        <h3>Background</h3>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '15px' }}>
                            {lockScreenSettings.backgroundImage ? (
                                <div style={{ position: 'relative', width: '100px', height: '150px', borderRadius: '8px', overflow: 'hidden', border: '2px solid rgba(255,255,255,0.2)' }}>
                                    <img
                                        src={lockScreenSettings.backgroundImage}
                                        alt="Background"
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                    <button
                                        onClick={clearBackground}
                                        style={{
                                            position: 'absolute', top: 5, right: 5,
                                            background: 'rgba(0,0,0,0.6)', border: 'none', color: 'white',
                                            borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                                        }}
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ) : (
                                <div style={{
                                    width: '100px', height: '150px',
                                    borderRadius: '8px', border: '2px dashed rgba(255,255,255,0.2)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', textAlign: 'center'
                                }}>
                                    No Image
                                </div>
                            )}

                            <div style={{ flex: 1 }}>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    style={{ display: 'none' }}
                                    accept="image/*"
                                    onChange={handleFileUpload}
                                />
                                <button className="control-btn secondary" onClick={() => fileInputRef.current.click()} style={{ marginBottom: '10px', width: '100%' }}>
                                    <Upload size={16} style={{ marginRight: 8 }} /> Upload Image
                                </button>

                                <label style={{ display: 'block', marginBottom: 5, fontSize: '0.9rem' }}>Dimming: {(lockScreenSettings.backgroundDim * 100).toFixed(0)}%</label>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.05"
                                    value={lockScreenSettings.backgroundDim || 0}
                                    onChange={(e) => updateSettings({ backgroundDim: parseFloat(e.target.value) })}
                                    style={{ width: '100%' }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: CALL SETTINGS */}
                <div>
                    <div className="card glass" style={{ marginBottom: '20px' }}>
                        <h3>Call Settings</h3>

                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: 5, fontSize: '0.9rem' }}>Caller Name</label>
                            <input
                                type="text"
                                className="input-field"
                                placeholder="Enter caller name"
                                value={lockScreenSettings.callName || ''}
                                onChange={(e) => updateSettings({ callName: e.target.value })}
                            />
                        </div>

                        {/* Position Offset Slider */}
                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: 5, fontSize: '0.9rem' }}>Caller Name Vertical Position</label>
                            <input
                                type="range"
                                min="0"
                                max="300"
                                step="5"
                                value={lockScreenSettings.callOffset ?? 40}
                                onChange={(e) => updateSettings({ callOffset: parseInt(e.target.value) })}
                                style={{ width: '100%' }}
                            />
                        </div>

                        <h3>Call Background Image</h3>
                        <p style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '15px' }}>If no image is set, the lockscreen background will be blurred instead.</p>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                            {lockScreenSettings.callImage ? (
                                <div style={{ position: 'relative', width: '100px', height: '150px', borderRadius: '8px', overflow: 'hidden', border: '2px solid rgba(255,255,255,0.2)', flexShrink: 0 }}>
                                    <img
                                        src={lockScreenSettings.callImage}
                                        alt="Call Background"
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                    <button
                                        onClick={clearCallBackground}
                                        style={{
                                            position: 'absolute', top: 5, right: 5,
                                            background: 'rgba(0,0,0,0.6)', border: 'none', color: 'white',
                                            borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                                        }}
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ) : (
                                <div style={{
                                    width: '100px', height: '150px', flexShrink: 0,
                                    borderRadius: '8px', border: '2px dashed rgba(255,255,255,0.2)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', textAlign: 'center'
                                }}>
                                    Blur/Fallback
                                </div>
                            )}

                            <div style={{ flex: 1 }}>
                                <input
                                    type="file"
                                    ref={callFileInputRef}
                                    style={{ display: 'none' }}
                                    accept="image/*"
                                    onChange={handleCallFileUpload}
                                />
                                <button className="control-btn secondary" onClick={() => callFileInputRef.current.click()} style={{ marginBottom: '10px', width: '100%' }}>
                                    <Upload size={16} style={{ marginRight: 8 }} /> Upload Image
                                </button>

                                <label style={{ display: 'block', marginBottom: 5, fontSize: '0.9rem' }}>Dimming: {((lockScreenSettings.callDim ?? 0.3) * 100).toFixed(0)}%</label>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.05"
                                    value={lockScreenSettings.callDim ?? 0.3}
                                    onChange={(e) => updateSettings({ callDim: parseFloat(e.target.value) })}
                                    style={{ width: '100%', marginBottom: '10px' }}
                                />

                                <label style={{ display: 'block', marginBottom: 5, fontSize: '0.9rem' }}>Blur: {lockScreenSettings.callBlur ?? 0}px</label>
                                <input
                                    type="range"
                                    min="0"
                                    max="30"
                                    step="1"
                                    value={lockScreenSettings.callBlur ?? 0}
                                    onChange={(e) => updateSettings({ callBlur: parseInt(e.target.value) })}
                                    style={{ width: '100%' }}
                                />
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}
