import React, { useRef } from 'react';
import { Upload, X, Clock, Calendar, Smartphone, Camera, Flashlight as FlashlightIcon, Image as ImageIcon } from 'lucide-react';
import axios from 'axios';

export default function LockScreenControl({ socket, data }) {
    const { lockScreenSettings } = data;
    const fileInputRef = useRef(null);

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


    return (
        <div className="control-section">
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Smartphone size={24} /> Lock Screen Control
            </h2>

            {/* Mode Selection */}
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
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        className={`control-btn ${lockScreenSettings.mode === 'black' ? 'primary' : ''}`}
                        onClick={() => updateSettings({ mode: 'black' })}
                        style={{ flex: 1 }}
                    >
                        Black Screen
                    </button>
                    <button
                        className={`control-btn ${lockScreenSettings.mode === 'lock' ? 'primary' : ''}`}
                        onClick={() => updateSettings({ mode: 'lock' })}
                        style={{ flex: 1 }}
                    >
                        Lock Screen UI
                    </button>
                </div>
            </div>

            {lockScreenSettings.mode === 'lock' && (
                <>
                    {/* Elements Toggles */}
                    <div className="card glass" style={{ marginBottom: '20px' }}>
                        <h3>Elements</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <button
                                className={`control-btn ${lockScreenSettings.showTime ? 'active' : ''}`}
                                onClick={() => updateSettings({ showTime: !lockScreenSettings.showTime })}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                            >
                                <Clock size={16} /> Time
                            </button>
                            <button
                                className={`control-btn ${lockScreenSettings.showDate ? 'active' : ''}`}
                                onClick={() => updateSettings({ showDate: !lockScreenSettings.showDate })}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                            >
                                <Calendar size={16} /> Date
                            </button>
                            <button
                                className={`control-btn ${lockScreenSettings.showFlashlight ? 'active' : ''}`}
                                onClick={() => updateSettings({ showFlashlight: !lockScreenSettings.showFlashlight })}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                            >
                                <FlashlightIcon size={16} /> Flashlight
                            </button>
                            <button
                                className={`control-btn ${lockScreenSettings.showCamera ? 'active' : ''}`}
                                onClick={() => updateSettings({ showCamera: !lockScreenSettings.showCamera })}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                            >
                                <Camera size={16} /> Camera
                            </button>
                        </div>
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
                </>
            )}
        </div>
    );
}
