export default function VfxControl({ socket, data }) {
    const settings = data.vfxSettings || {};

    const updateSettings = (updates) => {
        socket.emit('control:update_vfx_settings', updates);
    };

    return (
        <div style={{ padding: '20px', color: 'white' }}>
            {/* Header & Activation */}
            <div className="glass-panel" style={{ padding: '20px', borderRadius: '16px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0 }}>VFX Screen</h2>
                <button
                    className={`control-btn ${data.activeApp === 'vfx' ? 'primary' : 'success'}`}
                    style={{ width: 'auto' }}
                    onClick={() => socket.emit('control:switch_app', 'vfx')}
                    disabled={data.activeApp === 'vfx'}
                >
                    {data.activeApp === 'vfx' ? 'Active on Screen' : 'Show on Screen'}
                </button>
            </div>

            <div className="glass-panel" style={{ padding: '20px', borderRadius: '16px', marginBottom: '20px' }}>
                <h3 style={{ marginTop: 0 }}>Background Mode</h3>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                    <button
                        className={`control-btn ${settings.mode === 'green' ? 'primary' : 'secondary'}`}
                        onClick={() => updateSettings({ mode: 'green' })}
                    >
                        Green Screen
                    </button>
                    <button
                        className={`control-btn ${settings.mode === 'blue' ? 'primary' : 'secondary'}`}
                        onClick={() => updateSettings({ mode: 'blue' })}
                    >
                        Blue Screen
                    </button>
                    <button
                        className={`control-btn ${settings.mode === 'custom' ? 'primary' : 'secondary'}`}
                        onClick={() => updateSettings({ mode: 'custom' })}
                    >
                        Custom Color
                    </button>
                </div>

                {settings.mode === 'custom' && (
                    <div style={{ marginBottom: '20px' }}>
                        <label>Custom Color: </label>
                        <input
                            type="color"
                            value={settings.customColor || '#FF00FF'}
                            onChange={(e) => updateSettings({ customColor: e.target.value })}
                        />
                    </div>
                )}
            </div>

            <div className="glass-panel" style={{ padding: '20px', borderRadius: '16px' }}>
                <h3 style={{ marginTop: 0 }}>Tracking Markers</h3>
                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={settings.markersEnabled || false}
                            onChange={(e) => updateSettings({ markersEnabled: e.target.checked })}
                            style={{ width: '20px', height: '20px' }}
                        />
                        Enable Tracking Markers
                    </label>
                </div>

                {settings.markersEnabled && (
                    <div style={{ display: 'grid', gap: '15px', color: '#ccc' }}>
                        <div>
                            <label>Marker Color: </label>
                            <input
                                type="color"
                                value={settings.markerColor || '#FFFFFF'}
                                onChange={(e) => updateSettings({ markerColor: e.target.value })}
                                style={{ marginLeft: '10px' }}
                            />
                        </div>

                        <div>
                            <label>Grid Columns (X): {settings.markerCountX || 5}</label>
                            <input
                                type="range"
                                min="2"
                                max="10"
                                value={settings.markerCountX || 5}
                                onChange={(e) => updateSettings({ markerCountX: parseInt(e.target.value) })}
                                style={{ width: '100%', marginTop: '5px' }}
                            />
                        </div>

                        <div>
                            <label>Grid Rows (Y): {settings.markerCountY || 9}</label>
                            <input
                                type="range"
                                min="2"
                                max="15"
                                value={settings.markerCountY || 9}
                                onChange={(e) => updateSettings({ markerCountY: parseInt(e.target.value) })}
                                style={{ width: '100%', marginTop: '5px' }}
                            />
                        </div>

                        <div>
                            <label>Marker Size: {settings.markerSize || 20}px</label>
                            <input
                                type="range"
                                min="5"
                                max="50"
                                value={settings.markerSize || 20}
                                onChange={(e) => updateSettings({ markerSize: parseInt(e.target.value) })}
                                style={{ width: '100%', marginTop: '5px' }}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
