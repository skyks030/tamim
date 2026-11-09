// Color picker with alpha channel.
// Accepts "#rrggbb", "#rrggbbaa", "rgb(...)", "rgba(...)" or "transparent".
// Emits "#rrggbb" when fully opaque, otherwise "rgba(r,g,b,a)".

export function parseColor(value, fallback = '#000000') {
    const v = (value || fallback).trim();
    if (v === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
    if (v.startsWith('#')) {
        let hex = v.slice(1);
        if (hex.length === 3 || hex.length === 4) hex = hex.split('').map(c => c + c).join('');
        const r = parseInt(hex.slice(0, 2), 16) || 0;
        const g = parseInt(hex.slice(2, 4), 16) || 0;
        const b = parseInt(hex.slice(4, 6), 16) || 0;
        const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
        return { r, g, b, a };
    }
    const parts = v.match(/[\d.]+/g);
    if (parts && parts.length >= 3) {
        return {
            r: Math.round(parseFloat(parts[0])),
            g: Math.round(parseFloat(parts[1])),
            b: Math.round(parseFloat(parts[2])),
            a: parts.length >= 4 ? parseFloat(parts[3]) : 1
        };
    }
    return parseColor(fallback, '#000000');
}

const toHex = (n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');

export function formatColor({ r, g, b, a }) {
    if (a >= 1) return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    return `rgba(${r},${g},${b},${Math.round(a * 100) / 100})`;
}

const CHECKER = 'repeating-conic-gradient(#888 0% 25%, #444 0% 50%) 50% / 10px 10px';

export default function ColorAlphaPicker({ value, fallback = '#000000', onChange, label }) {
    const c = parseColor(value, fallback);
    const hex = `#${toHex(c.r)}${toHex(c.g)}${toHex(c.b)}`;
    const alphaPct = Math.round(c.a * 100);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {label && <label style={{ fontSize: '0.7rem', color: '#888' }}>{label}</label>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Swatch: checkerboard behind the real color so transparency is visible */}
                <div style={{ position: 'relative', width: 30, height: 30, borderRadius: 6, overflow: 'hidden', background: CHECKER, flexShrink: 0, border: '1px solid rgba(255,255,255,0.2)' }}>
                    <div style={{ position: 'absolute', inset: 0, background: formatColor(c) }} />
                    <input
                        type="color"
                        value={hex}
                        onChange={(e) => {
                            const n = parseColor(e.target.value);
                            onChange(formatColor({ ...n, a: c.a }));
                        }}
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', border: 'none', padding: 0 }}
                        title="Farbe wählen"
                    />
                </div>
                <input
                    type="range"
                    min="0"
                    max="100"
                    value={alphaPct}
                    onChange={(e) => onChange(formatColor({ ...c, a: parseInt(e.target.value, 10) / 100 }))}
                    style={{ width: 90 }}
                    title="Alpha / Deckkraft"
                />
                <span style={{ fontSize: '0.75rem', opacity: 0.7, width: 34, textAlign: 'right' }}>{alphaPct}%</span>
            </div>
        </div>
    );
}
