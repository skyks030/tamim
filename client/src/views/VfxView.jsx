import { useMemo, useEffect } from 'react';

export default function VfxView({ data }) {
    const settings = data.vfxSettings || {
        mode: 'green',
        greenColor: '#00FF00',
        blueColor: '#0000FF',
        customColor: '#FF00FF',
        markersEnabled: true,
        markerColor: '#000000ff',
        markerCountX: 5,
        markerCountY: 9,
        markerSize: 20
    };

    // Determine background color
    const bgColor = useMemo(() => {
        if (settings.mode === 'green') return settings.greenColor || '#00FF00';
        if (settings.mode === 'blue') return settings.blueColor || '#0000FF';
        return settings.customColor || '#FF00FF';
    }, [settings.mode, settings.greenColor, settings.blueColor, settings.customColor]);

    // Generate Markers Grid
    const markers = useMemo(() => {
        if (!settings.markersEnabled) return null;

        const cols = settings.markerCountX || 5;
        const rows = settings.markerCountY || 9;
        const grid = [];

        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                grid.push({ x, y });
            }
        }
        return { grid, cols, rows };
    }, [settings.markersEnabled, settings.markerCountX, settings.markerCountY]);

    // Sync Meta Theme Color & Body Background for Notch/Overscroll support
    useEffect(() => {
        // 1. Update Meta Tag (iOS Safari / Android Chrome)
        let metaThemeColor = document.querySelector("meta[name='theme-color']");
        if (!metaThemeColor) {
            metaThemeColor = document.createElement('meta');
            metaThemeColor.name = "theme-color";
            document.head.appendChild(metaThemeColor);
        }
        metaThemeColor.setAttribute("content", bgColor);

        // 2. Update Body & HTML Background (Overscroll / Notch area)
        document.body.style.backgroundColor = bgColor;
        document.documentElement.style.backgroundColor = bgColor;

        // Cleanup: Reset to black when leaving this view
        return () => {
            metaThemeColor.setAttribute("content", "#000000");
            document.body.style.backgroundColor = "#000000";
            document.documentElement.style.backgroundColor = "#000000";
        };
    }, [bgColor]);

    return (
        <div style={{
            width: '100vw',
            height: '100dvh', // dynamic viewport height
            backgroundColor: bgColor,
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        }}>
            {settings.markersEnabled && markers && (
                <div style={{
                    display: 'grid',
                    width: '100%',
                    height: '100%',
                    gridTemplateColumns: `repeat(${markers.cols}, 1fr)`,
                    gridTemplateRows: `repeat(${markers.rows}, 1fr)`,
                }}>
                    {markers.grid.map((pos, idx) => (
                        <div key={idx} style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '0px solid rgba(0,0,0,0.05)' // Optional guide lines for debugging
                        }}>
                            {/* Triangle Marker */}
                            <svg
                                width={settings.markerSize || 20}
                                height={settings.markerSize || 20}
                                viewBox="0 0 24 24"
                                fill={settings.markerColor || 'white'}
                            >
                                <path d="M12 2 L22 22 L2 22 Z" />
                            </svg>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
