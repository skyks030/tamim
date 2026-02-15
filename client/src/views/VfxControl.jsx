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

            <div className="glass-panel" style={{ padding: '15px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '15px', height: 'calc(100vh - 140px)', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
                    <h3 style={{ margin: 0, fontSize: '18px' }}>Tracking Markers</h3>
                    <div style={{ fontSize: '12px', color: '#888' }}>Compact Mode</div>
                </div>

                <div style={{ display: 'flex', gap: '20px', height: '100%', overflow: 'auto' }}>
                    {/* Left Column: Static Markers */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: 'bold' }}>
                                <input
                                    type="checkbox"
                                    checked={settings.markersEnabled || false}
                                    onChange={(e) => updateSettings({ markersEnabled: e.target.checked })}
                                    style={{ width: '16px', height: '16px' }}
                                />
                                Static Markers
                            </label>
                        </div>

                        {settings.markersEnabled && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px' }}>
                                <div style={{ gridColumn: 'span 2' }}>
                                    <label>Color</label>
                                    <input
                                        type="color"
                                        value={settings.markerColor || '#FFFFFF'}
                                        onChange={(e) => updateSettings({ markerColor: e.target.value })}
                                        style={{ width: '100%', height: '30px', border: 'none', padding: 0, marginTop: '2px' }}
                                    />
                                </div>

                                <div>
                                    <label>Cols (X)</label>
                                    <input
                                        type="range"
                                        min="1"
                                        max="20"
                                        className="compact-slider"
                                        value={settings.markerCountX || 5}
                                        onChange={(e) => updateSettings({ markerCountX: parseInt(e.target.value) })}
                                    />
                                </div>
                                <div>
                                    <label>Rows (Y)</label>
                                    <input
                                        type="range"
                                        min="1"
                                        max="20"
                                        className="compact-slider"
                                        value={settings.markerCountY || 9}
                                        onChange={(e) => updateSettings({ markerCountY: parseInt(e.target.value) })}
                                    />
                                </div>

                                <div style={{ gridColumn: 'span 2' }}>
                                    <label>Spacing (px)</label>
                                    <input
                                        type="range"
                                        min="10"
                                        max="500"
                                        className="compact-slider"
                                        value={settings.markerSpacing || 100}
                                        onChange={(e) => updateSettings({ markerSpacing: parseInt(e.target.value) })}
                                        style={{ width: '100%' }}
                                    />
                                </div>

                                <div style={{ gridColumn: 'span 2' }}>
                                    <label>Size (px)</label>
                                    <input
                                        type="range"
                                        min="5"
                                        max="150"
                                        className="compact-slider"
                                        value={settings.markerSize || 20}
                                        onChange={(e) => updateSettings({ markerSize: parseInt(e.target.value) })}
                                        style={{ width: '100%' }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Divider */}
                    <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)' }}></div>

                    {/* Right Column: Scrolling Markers */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: 'bold' }}>
                                <input
                                    type="checkbox"
                                    checked={settings.scrollingMarkersEnabled || false}
                                    onChange={(e) => updateSettings({ scrollingMarkersEnabled: e.target.checked })}
                                    style={{ width: '16px', height: '16px' }}
                                />
                                Scrolling Markers
                            </label>
                        </div>

                        {settings.scrollingMarkersEnabled && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px' }}>
                                <div style={{ gridColumn: 'span 2' }}>
                                    <label>Direction</label>
                                    <div style={{ display: 'flex', gap: '2px', marginTop: '2px' }}>
                                        {['vertical', 'horizontal', 'both'].map(dir => (
                                            <button
                                                key={dir}
                                                className={`control-btn ${settings.scrollDirection === dir ? 'primary' : 'secondary'}`}
                                                onClick={() => updateSettings({ scrollDirection: dir })}
                                                style={{ flex: 1, textTransform: 'capitalize', fontSize: '10px', padding: '4px' }}
                                            >
                                                {dir}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div style={{ gridColumn: 'span 2' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={settings.scrollingMomentum || false}
                                            onChange={(e) => updateSettings({ scrollingMomentum: e.target.checked })}
                                            style={{ width: '14px', height: '14px' }}
                                        />
                                        Natural Scroll (Momentum)
                                    </label>
                                </div>

                                <div style={{ gridColumn: 'span 2' }}>
                                    <label>Color</label>
                                    <input
                                        type="color"
                                        value={settings.scrollingMarkerColor || '#FFFF00'}
                                        onChange={(e) => updateSettings({ scrollingMarkerColor: e.target.value })}
                                        style={{ width: '100%', height: '30px', border: 'none', padding: 0, marginTop: '2px' }}
                                    />
                                </div>

                                <div>
                                    <label>Cols (X)</label>
                                    <input
                                        type="range"
                                        min="1"
                                        max="20"
                                        className="compact-slider"
                                        value={settings.scrollingMarkerCountX || 5}
                                        onChange={(e) => updateSettings({ scrollingMarkerCountX: parseInt(e.target.value) })}
                                    />
                                </div>

                                <div>
                                    <label>Rows (Y)</label>
                                    <input
                                        type="range"
                                        min="1"
                                        max="20"
                                        className="compact-slider"
                                        value={settings.scrollingMarkerCountY || 9}
                                        onChange={(e) => updateSettings({ scrollingMarkerCountY: parseInt(e.target.value) })}
                                    />
                                </div>

                                <div style={{ gridColumn: 'span 2' }}>
                                    <label>Spacing (px)</label>
                                    <input
                                        type="range"
                                        min="10"
                                        max="500"
                                        className="compact-slider"
                                        value={settings.scrollingMarkerSpacing || 100}
                                        onChange={(e) => updateSettings({ scrollingMarkerSpacing: parseInt(e.target.value) })}
                                        style={{ width: '100%' }}
                                    />
                                </div>

                                <div style={{ gridColumn: 'span 2' }}>
                                    <label>Size (px)</label>
                                    <input
                                        type="range"
                                        min="5"
                                        max="150"
                                        className="compact-slider"
                                        value={settings.scrollingMarkerSize || 15}
                                        onChange={(e) => updateSettings({ scrollingMarkerSize: parseInt(e.target.value) })}
                                        style={{ width: '100%' }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <style>{`
                    .compact-slider {
                        width: 100%;
                        margin-top: 5px;
                        -webkit-appearance: none;
                        height: 4px;
                        background: rgba(255,255,255,0.2);
                        border-radius: 2px;
                        outline: none;
                    }
                    .compact-slider::-webkit-slider-thumb {
                        -webkit-appearance: none;
                        width: 12px;
                        height: 12px;
                        background: white;
                        border-radius: 50%;
                        cursor: pointer;
                    }
                `}</style>
            </div>
        </div>
    );
}
