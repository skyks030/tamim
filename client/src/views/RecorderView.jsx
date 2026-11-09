import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import axios from 'axios';
import {
    Circle, Square, MousePointer2, Play, Download, Trash2, Monitor, Maximize2,
    Lock, Unlock, Film, Edit2, Smartphone, X, RotateCcw, Clapperboard, Server
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

// CSS viewport (layout size) + device pixel ratio of common phones
const PRESETS = [
    { id: 'iphone16pro', label: 'iPhone 16 Pro', w: 402, h: 874, dpr: 3 },
    { id: 'iphone16', label: 'iPhone 16 / 15 Pro', w: 393, h: 852, dpr: 3 },
    { id: 'iphone16promax', label: 'iPhone 16 Pro Max', w: 440, h: 956, dpr: 3 },
    { id: 'iphone13mini', label: 'iPhone 13 mini', w: 375, h: 812, dpr: 3 },
    { id: 'iphonese', label: 'iPhone SE', w: 375, h: 667, dpr: 2 },
    { id: 'pixel8', label: 'Google Pixel 8', w: 412, h: 915, dpr: 2.625 },
    { id: 'galaxys24', label: 'Samsung Galaxy S24', w: 360, h: 780, dpr: 3 },
    { id: 'hd916', label: '9:16 (1080 × 1920)', w: 360, h: 640, dpr: 3 },
    { id: 'free', label: 'Frei', w: 400, h: 800, dpr: 3 }
];

const FPS_FALLBACK = ['23.976', '24', '25', '29.97', '30', '50', '59.94', '60'];
const SPECIAL_KEYS = ['Enter', 'Backspace', 'Tab', 'Escape', 'Delete', 'ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'];

const PINK = '#ec4899';
const PINK_LIGHT = '#f9a8d4';
const PINK_GRADIENT = 'linear-gradient(135deg, #f472b6 0%, #ec4899 55%, #db2777 100%)';
const CHECKER = 'repeating-conic-gradient(#3a3a46 0% 25%, #2a2a33 0% 50%) 50% / 16px 16px';

const DEFAULT_SETTINGS = {
    presetId: 'iphone16pro',
    w: 402,
    h: 874,
    dpr: 3,
    lockAspect: true,
    format: 'prores_hq',
    fps: '30',
    transparent: false,
    alphaMode: 'premultiplied',
    namePrefix: 'Take',
    leadIn: 500,
    tail: 1000
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function usePersistentState(key, initial) {
    const [value, setValue] = useState(() => {
        try {
            const s = localStorage.getItem(key);
            if (s === null) return initial;
            const parsed = JSON.parse(s);
            if (initial && typeof initial === 'object' && !Array.isArray(initial) && parsed && typeof parsed === 'object') return { ...initial, ...parsed };
            return parsed;
        } catch { return initial; }
    });
    useEffect(() => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ } }, [key, value]);
    return [value, setValue];
}

const fmtTime = (ms) => {
    const s = Math.max(0, ms) / 1000;
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${(s % 60).toFixed(1).padStart(4, '0')}`;
};
const fmtBytes = (b) => (!b ? '' : b > 1e9 ? `${(b / 1e9).toFixed(2)} GB` : `${(b / 1e6).toFixed(1)} MB`);
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// ---------------------------------------------------------------------------
// UI bits
// ---------------------------------------------------------------------------

const inputStyle = {
    width: '100%', padding: '8px 10px', borderRadius: 8,
    background: 'rgba(0,0,0,0.35)', color: 'white', border: '1px solid rgba(255,255,255,0.12)',
    fontFamily: 'inherit', fontSize: '0.85rem', outline: 'none'
};

const btn = (variant = 'ghost', extra = {}) => ({
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: '7px 12px', borderRadius: 10,
    border: variant === 'ghost' ? '1px solid rgba(255,255,255,0.14)' : 'none',
    background: variant === 'pink' ? PINK_GRADIENT : variant === 'danger' ? 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)' : 'rgba(255,255,255,0.06)',
    color: 'white', fontFamily: 'inherit', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
    ...extra
});

function Section({ title, icon, children, right }) {
    return (
        <div className="glass" style={{ padding: 16, borderRadius: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: PINK_LIGHT, fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                    {icon}{title}
                </div>
                {right}
            </div>
            {children}
        </div>
    );
}

function Field({ label, children, hint }) {
    return (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: '0.72rem', opacity: 0.65 }}>{label}</span>
            {children}
            {hint && <span style={{ fontSize: '0.68rem', opacity: 0.45, lineHeight: 1.4 }}>{hint}</span>}
        </label>
    );
}

function Check({ checked, onChange, children, disabled }) {
    return (
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '0.82rem', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1 }}>
            <input type="checkbox" checked={!!checked} disabled={disabled} onChange={e => onChange(e.target.checked)} style={{ accentColor: PINK, marginTop: 2 }} />
            <span>{children}</span>
        </label>
    );
}

function Banner({ tone = 'warn', children }) {
    const c = tone === 'error' ? '239,68,68' : tone === 'pink' ? '236,72,153' : '234,179,8';
    return <div style={{ padding: '8px 12px', borderRadius: 10, background: `rgba(${c},0.15)`, border: `1px solid rgba(${c},0.4)`, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 10 }}>{children}</div>;
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

// alpha (0..1) of a CSS colour string
function colorAlpha(c) {
    if (!c) return 1;
    if (c === 'transparent') return 0;
    if (c.startsWith('#')) return c.length === 9 ? parseInt(c.slice(7, 9), 16) / 255 : 1;
    const parts = c.match(/[\d.]+/g);
    return parts && parts.length >= 4 ? parseFloat(parts[3]) : 1;
}

export default function RecorderView({ socket, data }) {
    const canvasRef = useRef(null);
    const stageRef = useRef(null);

    const [settings, setSettings] = usePersistentState('recorder2_settings', DEFAULT_SETTINGS);
    const set = (patch) => setSettings(s => ({ ...s, ...patch }));
    const [counter, setCounter] = usePersistentState('recorder_counter', 1);
    const preset = PRESETS.find(p => p.id === settings.presetId) || PRESETS[0];
    const aspect = preset.id === 'free' ? null : preset.w / preset.h;

    const [caps, setCaps] = useState(null);
    const [srv, setSrv] = useState(null);           // live state from server
    const [connected, setConnected] = useState(socket.connected);
    const [hasFrame, setHasFrame] = useState(false);
    const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
    const [dragSize, setDragSize] = useState(null);  // CSS size while dragging the handle
    const [error, setError] = useState(null);
    const [recordings, setRecordings] = useState([]);

    // REC
    const [recBusy, setRecBusy] = useState(false);
    const [recStart, setRecStart] = useState(null);
    const [elapsed, setElapsed] = useState(0);

    // Pointer takes
    const [takes, setTakes] = usePersistentState('recorder2_takes', []);
    const [activeTakeId, setActiveTakeId] = usePersistentState('recorder2_active_take', null);
    const activeTake = takes.find(t => t.id === activeTakeId) || null;
    const [takeRec, setTakeRec] = useState(false);
    const takeBuf = useRef(null);
    const importRef = useRef(null);

    const recording = !!srv?.recording;
    const cssW = dragSize?.w ?? settings.w;
    const cssH = dragSize?.h ?? settings.h;
    const pxW = Math.round(cssW * settings.dpr);
    const pxH = Math.round(cssH * settings.dpr);

    // -----------------------------------------------------------------------
    // Server connection
    // -----------------------------------------------------------------------
    useEffect(() => {
        document.title = 'Screen Recorder';
        document.body.style.backgroundColor = '#0f172a';
        document.documentElement.style.backgroundColor = '#0f172a';
    });

    useEffect(() => {
        const join = () => socket.emit('rec:join', { viewport: { w: settings.w, h: settings.h } }, (st) => st && setSrv(st));
        const onConnect = () => { setConnected(true); join(); };
        const onDisconnect = () => setConnected(false);
        const onState = (st) => setSrv(st);
        const onFrame = async ({ jpeg }) => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            try {
                const bmp = await createImageBitmap(new Blob([jpeg], { type: 'image/jpeg' }));
                if (canvas.width !== bmp.width || canvas.height !== bmp.height) { canvas.width = bmp.width; canvas.height = bmp.height; }
                canvas.getContext('2d').drawImage(bmp, 0, 0);
                bmp.close?.();
                setHasFrame(true);
            } catch { /* corrupt frame */ }
        };
        const onJob = (job) => setRecordings(list => {
            const i = list.findIndex(r => r.id === job.id);
            if (i === -1) return [job, ...list];
            const copy = [...list]; copy[i] = job; return copy;
        });
        const onDeleted = ({ id }) => setRecordings(list => list.filter(r => r.id !== id));

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('rec:state', onState);
        socket.on('rec:frame', onFrame);
        socket.on('recorder:job', onJob);
        socket.on('recorder:job_deleted', onDeleted);
        if (socket.connected) join();

        axios.get('/api/recordings/capabilities').then(r => setCaps(r.data)).catch(() => setCaps({ ffmpeg: false, chromium: false, formats: [], fps: FPS_FALLBACK }));
        axios.get('/api/recordings').then(r => setRecordings(r.data)).catch(() => { });

        return () => {
            socket.emit('rec:leave');
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('rec:state', onState);
            socket.off('rec:frame', onFrame);
            socket.off('recorder:job', onJob);
            socket.off('recorder:job_deleted', onDeleted);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [socket]);

    // Push viewport (layout size) to the virtual phone
    useEffect(() => {
        if (recording) return;
        const t = setTimeout(() => socket.emit('rec:viewport', { w: settings.w, h: settings.h }), 250);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [settings.w, settings.h]);

    useEffect(() => {
        if (!stageRef.current) return;
        const ro = new ResizeObserver(([e]) => setStageSize({ w: e.contentRect.width, h: e.contentRect.height }));
        ro.observe(stageRef.current);
        return () => ro.disconnect();
    }, []);

    // REC timer
    useEffect(() => {
        if (!recStart) return;
        const i = setInterval(() => setElapsed(Date.now() - recStart), 100);
        return () => clearInterval(i);
    }, [recStart]);
    useEffect(() => { if (!recording) setRecStart(null); }, [recording]);

    // Format list depends on transparency
    const allFormats = caps?.formats || [];
    const formats = allFormats.filter(f => !!f.alpha === !!settings.transparent);
    useEffect(() => {
        if (formats.length && !formats.find(f => f.key === settings.format)) set({ format: formats[0].key });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [caps, settings.transparent]);

    // -----------------------------------------------------------------------
    // Preview geometry (fit the phone into the stage)
    // -----------------------------------------------------------------------
    const PAD = 40;
    const scale = useMemo(() => {
        if (!stageSize.w) return 1;
        return Math.min((stageSize.w - PAD * 2) / cssW, (stageSize.h - PAD * 2) / cssH);
    }, [stageSize, cssW, cssH]);
    const viewW = Math.max(50, Math.round(cssW * scale));
    const viewH = Math.max(50, Math.round(cssH * scale));

    // -----------------------------------------------------------------------
    // Remote input
    // -----------------------------------------------------------------------
    const sendInput = useCallback((ev) => {
        socket.emit('rec:input', ev);
        if (takeBuf.current) takeBuf.current.push({ ...ev, t: Math.round(performance.now() * 10) / 10 });
    }, [socket]);

    const norm = (e) => {
        const r = canvasRef.current.getBoundingClientRect();
        return {
            x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
            y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
        };
    };

    const pendingMove = useRef(null);
    const onPointerDown = (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        canvasRef.current.focus();
        canvasRef.current.setPointerCapture(e.pointerId);
        sendInput({ kind: 'mouse', type: 'down', buttons: 1, ...norm(e) });
    };
    const onPointerMove = (e) => {
        const ev = { kind: 'mouse', type: 'move', buttons: e.buttons & 1, ...norm(e) };
        if (!pendingMove.current) {
            requestAnimationFrame(() => { if (pendingMove.current) sendInput(pendingMove.current); pendingMove.current = null; });
        }
        pendingMove.current = ev;
    };
    const onPointerUp = (e) => {
        if (e.button !== 0) return;
        if (pendingMove.current) { sendInput(pendingMove.current); pendingMove.current = null; }
        sendInput({ kind: 'mouse', type: 'up', buttons: 0, ...norm(e) });
    };
    const onKeyDown = (e) => {
        if (e.metaKey || e.ctrlKey) return;
        if (SPECIAL_KEYS.includes(e.key)) { e.preventDefault(); sendInput({ kind: 'key', key: e.key }); }
        else if (e.key.length === 1) { e.preventDefault(); sendInput({ kind: 'key', text: e.key }); }
    };
    // wheel needs a non-passive listener
    useEffect(() => {
        const c = canvasRef.current;
        if (!c) return;
        const onWheel = (e) => {
            e.preventDefault();
            sendInput({ kind: 'wheel', dx: e.deltaX, dy: e.deltaY, ...norm(e) });
        };
        c.addEventListener('wheel', onWheel, { passive: false });
        return () => c.removeEventListener('wheel', onWheel);
    }, [sendInput]);

    // -----------------------------------------------------------------------
    // Size controls
    // -----------------------------------------------------------------------
    function changePreset(id) {
        const p = PRESETS.find(x => x.id === id) || PRESETS[0];
        set({ presetId: p.id, w: p.w, h: p.h, dpr: p.dpr });
    }
    function setDim(axis, v) {
        v = Math.max(200, Math.min(axis === 'w' ? 1600 : 3200, parseInt(v, 10) || 0));
        if (settings.lockAspect && aspect) set(axis === 'w' ? { w: v, h: Math.round(v / aspect) } : { w: Math.round(v * aspect), h: v });
        else set({ [axis]: v });
    }
    const onHandleDown = (e) => {
        if (recording) return;
        e.preventDefault();
        const sx = e.clientX, sy = e.clientY;
        const start = { w: settings.w, h: settings.h };
        const s0 = scale;
        let last = start;
        const move = (ev) => {
            // phone is centred and fitted: convert screen delta to CSS px
            let w = Math.max(200, start.w + ((ev.clientX - sx) * 2) / s0);
            let h = Math.max(300, start.h + ((ev.clientY - sy) * 2) / s0);
            if (settings.lockAspect && aspect) {
                if (Math.abs(ev.clientX - sx) >= Math.abs(ev.clientY - sy) * aspect) h = w / aspect; else w = h * aspect;
            }
            last = { w: Math.round(w), h: Math.round(h) };
            setDragSize(last);
        };
        const up = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
            setDragSize(null);
            set(last);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
    };

    // -----------------------------------------------------------------------
    // REC
    // -----------------------------------------------------------------------
    const renderSettings = () => ({ format: settings.format, fps: settings.fps, transparent: settings.transparent, alphaMode: settings.alphaMode, dpr: settings.dpr });
    const nextName = () => {
        const n = `${settings.namePrefix || 'Take'}_${String(counter).padStart(3, '0')}`;
        setCounter(c => c + 1);
        return n;
    };

    function startRec() {
        setError(null);
        setRecBusy(true);
        socket.emit('rec:start', {}, (res) => {
            setRecBusy(false);
            if (res?.error) setError(res.error);
            else setRecStart(Date.now());
        });
    }
    function stopRec(discard = false) {
        socket.emit('rec:stop', { discard, name: discard ? null : nextName(), settings: renderSettings() }, (res) => {
            if (res?.error) setError(res.error);
        });
        setRecStart(null);
    }

    // -----------------------------------------------------------------------
    // Pointer takes
    // -----------------------------------------------------------------------
    function startTakeRec() { takeBuf.current = []; setTakeRec(true); }
    function stopTakeRec() {
        let evs = takeBuf.current || [];
        takeBuf.current = null;
        setTakeRec(false);
        const first = evs.findIndex(e => e.kind !== 'mouse' || e.type === 'down');
        if (first === -1) return;
        evs = evs.slice(first);
        let last = evs.length - 1;
        while (last > 0 && evs[last].kind === 'mouse' && evs[last].type === 'move') last--;
        evs = evs.slice(0, last + 1);
        const base = evs[0].t;
        evs = evs.map(e => ({ ...e, t: Math.round((e.t - base) * 10) / 10 }));
        const take = {
            id: newId(),
            name: `Zeiger ${takes.length + 1}`,
            createdAt: Date.now(),
            duration: evs[evs.length - 1].t,
            viewport: { w: settings.w, h: settings.h },
            events: evs
        };
        setTakes(list => [...list, take]);
        setActiveTakeId(take.id);
    }
    function renderTake(take) {
        setError(null);
        socket.emit('rec:render_take', {
            take,
            name: nextName(),
            settings: { ...renderSettings(), leadIn: settings.leadIn, tail: settings.tail }
        }, (res) => { if (res?.error) setError(res.error); });
    }
    function exportTakes() {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([JSON.stringify(takes, null, 2)], { type: 'application/json' }));
        a.download = 'zeiger-aufnahmen.json';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }
    function importTakes(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        file.text().then(text => {
            const arr = JSON.parse(text);
            if (!Array.isArray(arr)) throw new Error('Ungültige Datei');
            setTakes(list => [...list, ...arr.filter(t => Array.isArray(t.events)).map(t => ({ ...t, id: newId() }))]);
        }).catch(err => alert(`Import fehlgeschlagen: ${err.message}`));
        e.target.value = '';
    }

    async function deleteRecording(r) {
        if (!confirm(`„${r.name}“ vom Server löschen?`)) return;
        try {
            await axios.delete(`/api/recordings/${r.id}`);
            setRecordings(list => list.filter(x => x.id !== r.id));
        } catch (e) { alert(`Löschen fehlgeschlagen: ${e.message}`); }
    }

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------
    const fpsOptions = caps?.fps?.length ? caps.fps : FPS_FALLBACK;
    const takeSizeMismatch = activeTake?.viewport && (activeTake.viewport.w !== settings.w || activeTake.viewport.h !== settings.h);
    const serverProblem = caps && (!caps.chromium || !caps.ffmpeg);

    return (
        <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#0f172a', color: 'white' }}>
            <style>{`
                @keyframes recPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(236,72,153,0.7); } 50% { box-shadow: 0 0 0 10px rgba(236,72,153,0); } }
                @keyframes recBlink { 0%,100% { opacity: 1 } 50% { opacity: 0.25 } }
                .rec-scroll::-webkit-scrollbar { width: 8px; }
                .rec-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 4px; }
                .rec-select option { background: #1e293b; }
                .rec-canvas:focus { outline: none; }
            `}</style>

            {/* HEADER */}
            <div className="glass" style={{ margin: 12, marginBottom: 0, padding: '10px 16px', borderRadius: 16, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: PINK_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Film size={18} />
                    </div>
                    <h2 style={{ margin: 0, fontSize: '1.15rem' }}>Screen Recorder</h2>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                    <a href="/control" style={{ ...btn(), textDecoration: 'none' }}><Monitor size={14} /> Control Center</a>
                    <a href="/app" target="_blank" rel="noreferrer" style={{ ...btn(), textDecoration: 'none' }}><Smartphone size={14} /> Actor App</a>
                </div>
                <div style={{ flex: 1 }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem' }}>
                    <Server size={14} style={{ opacity: 0.7 }} />
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: connected && srv?.ready ? '#22c55e' : srv?.error ? '#ef4444' : '#eab308' }} />
                    {!connected ? 'Keine Verbindung' : srv?.ready ? 'Virtuelles Handy bereit' : srv?.error ? 'Fehler' : 'Starte virtuelles Handy…'}
                </div>
                {!recording ? (
                    <button onClick={startRec} disabled={recBusy || !srv?.ready}
                        style={btn('pink', { padding: '10px 22px', fontSize: '0.95rem', borderRadius: 999, opacity: srv?.ready ? 1 : 0.5 })}>
                        <Circle size={16} fill="white" /> {recBusy ? 'Bereite vor…' : 'REC'}
                    </button>
                ) : (
                    <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => stopRec(false)}
                            style={btn('pink', { padding: '10px 22px', fontSize: '0.95rem', borderRadius: 999, animation: 'recPulse 1.4s infinite', fontVariantNumeric: 'tabular-nums' })}>
                            <Square size={14} fill="white" /> STOP <span style={{ marginLeft: 6, animation: 'recBlink 1s infinite' }}>●</span> {fmtTime(elapsed)}
                        </button>
                        <button onClick={() => stopRec(true)} style={btn('ghost', { borderRadius: 999 })} title="Aufnahme verwerfen"><X size={14} /></button>
                    </div>
                )}
            </div>

            {settings.transparent && data && (data.activeApp !== 'dating' || colorAlpha(data.datingTheme?.background) > 0) && (
                <div style={{ margin: '8px 12px 0' }}>
                    <Banner tone="warn">
                        <span style={{ flex: 1 }}>
                            {data.activeApp !== 'dating'
                                ? 'Transparenz ist an, aber gerade ist nicht die Dating-App aktiv. Nur die Dating-App hat einen einstellbar transparenten Hintergrund – das Video wäre komplett deckend.'
                                : `Transparenz ist an, aber der Hintergrund der Dating-App ist zu ${Math.round(colorAlpha(data.datingTheme?.background) * 100)} % deckend – das Video hätte keinen durchsichtigen Hintergrund.`}
                        </span>
                        {data.activeApp === 'dating' && (
                            <button style={btn('pink')} onClick={() => {
                                const m = (data.datingTheme?.background || '#111111').match(/[\da-f]{2}/gi);
                                const rgb = (data.datingTheme?.background || '').startsWith('#') && m ? m.slice(0, 3).map(h => parseInt(h, 16)) : ((data.datingTheme?.background || '').match(/[\d.]+/g) || [17, 17, 17]).slice(0, 3);
                                socket.emit('control:update_dating_theme', { background: `rgba(${rgb.join(',')},0)` });
                            }}>Hintergrund jetzt transparent stellen</button>
                        )}
                    </Banner>
                </div>
            )}

            {(serverProblem || srv?.error || error) && (
                <div style={{ margin: '8px 12px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {caps && !caps.chromium && <Banner tone="error">Auf dem Server ist kein Chromium installiert. Bitte das Update mit <code>bash update.sh</code> neu bauen.</Banner>}
                    {caps && !caps.ffmpeg && <Banner tone="error">Auf dem Server fehlt ffmpeg – Videos können nicht erzeugt werden.</Banner>}
                    {srv?.error && <Banner tone="error"><span style={{ flex: 1 }}>Virtuelles Handy: {srv.error}</span><button style={btn()} onClick={() => socket.emit('rec:reload')}><RotateCcw size={12} /> Neu starten</button></Banner>}
                    {error && <Banner tone="pink"><span style={{ flex: 1 }}>{error}</span><button style={btn('ghost', { padding: '4px 8px' })} onClick={() => setError(null)}><X size={12} /></button></Banner>}
                </div>
            )}

            {/* BODY */}
            <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '300px 1fr 330px', gap: 12, padding: 12 }}>

                {/* LEFT */}
                <div className="rec-scroll" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
                    <Section title="Gerät / Auflösung" icon={<Smartphone size={14} />}>
                        <Field label="Gerät">
                            <select className="rec-select" style={inputStyle} value={settings.presetId} disabled={recording} onChange={e => changePreset(e.target.value)}>
                                {PRESETS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                            </select>
                        </Field>
                        <Field label="Layout-Größe (CSS-Pixel)" hint="Bestimmt, wie die App aussieht – wie die Bildschirmgröße eines Handys.">
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <input style={inputStyle} type="number" value={cssW} disabled={recording} onChange={e => setDim('w', e.target.value)} />
                                <span style={{ opacity: 0.5 }}>×</span>
                                <input style={inputStyle} type="number" value={cssH} disabled={recording} onChange={e => setDim('h', e.target.value)} />
                                <button style={btn('ghost', { padding: '7px 8px', borderColor: settings.lockAspect && aspect ? PINK : undefined })}
                                    disabled={!aspect} onClick={() => set({ lockAspect: !settings.lockAspect })}
                                    title={settings.lockAspect ? 'Seitenverhältnis gesperrt' : 'Seitenverhältnis frei'}>
                                    {settings.lockAspect && aspect ? <Lock size={14} /> : <Unlock size={14} />}
                                </button>
                            </div>
                        </Field>
                        <Field label={`Pixeldichte (Skalierung): ${settings.dpr}×`} hint="Bestimmt die Pixelauflösung des Videos, ohne das Layout zu verändern.">
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <input type="range" min="1" max="4" step="0.125" value={settings.dpr} onChange={e => set({ dpr: parseFloat(e.target.value) })} style={{ flex: 1, accentColor: PINK }} />
                                <input style={{ ...inputStyle, width: 70 }} type="number" step="0.125" min="0.5" max="6" value={settings.dpr} onChange={e => set({ dpr: Math.min(6, Math.max(0.5, parseFloat(e.target.value) || 1)) })} />
                            </div>
                        </Field>
                        <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(236,72,153,0.1)', border: '1px solid rgba(236,72,153,0.3)' }}>
                            <div style={{ fontSize: '0.68rem', opacity: 0.6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Video-Auflösung</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: PINK_LIGHT, fontVariantNumeric: 'tabular-nums' }}>{pxW} × {pxH} px</div>
                            {(pxW % 2 || pxH % 2) ? <div style={{ fontSize: '0.68rem', opacity: 0.55 }}>Video-Codecs brauchen gerade Maße → {pxW - (pxW % 2)} × {pxH - (pxH % 2)}</div> : null}
                        </div>
                    </Section>

                    <Section title="Aufnahmeformat" icon={<Film size={14} />}>
                        <Check checked={settings.transparent} disabled={recording} onChange={v => set({ transparent: v })}>
                            Transparenter Hintergrund (echter Alpha-Kanal)
                        </Check>
                        {settings.transparent && (
                            <div style={{ fontSize: '0.7rem', opacity: 0.6, lineHeight: 1.4, marginTop: -6 }}>
                                Im Control Center beim Dating-Theme den Background-Alpha auf 0 % stellen – alles Durchsichtige der App wird im Video transparent. Die Vorschau zeigt den Hintergrund trotzdem an.
                            </div>
                        )}
                        {settings.transparent && settings.format !== 'png_mov' && (
                            <Field label="Alpha-Modus" hint="Premultiplied ist der Standard für ProRes 4444 (Final Cut, Premiere, Resolve, After Effects). Straight nur wählen, wenn das Schnittprogramm es ausdrücklich verlangt.">
                                <select className="rec-select" style={inputStyle} value={settings.alphaMode} disabled={recording} onChange={e => set({ alphaMode: e.target.value })}>
                                    <option value="premultiplied">Premultiplied (empfohlen)</option>
                                    <option value="straight">Straight</option>
                                </select>
                            </Field>
                        )}
                        <Field label="Codec / Container">
                            <select className="rec-select" style={inputStyle} value={settings.format} disabled={recording} onChange={e => set({ format: e.target.value })}>
                                {formats.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                            </select>
                        </Field>
                        <Field label="Bildrate" hint="Jedes Bild wird auf dem Server exakt zum richtigen Zeitpunkt gerendert – keine ausgelassenen Frames.">
                            <select className="rec-select" style={inputStyle} value={settings.fps} disabled={recording} onChange={e => set({ fps: e.target.value })}>
                                {fpsOptions.map(f => <option key={f} value={f}>{f} fps</option>)}
                            </select>
                        </Field>
                        <Field label="Clip-Name">
                            <div style={{ display: 'flex', gap: 6 }}>
                                <input style={inputStyle} value={settings.namePrefix} onChange={e => set({ namePrefix: e.target.value })} />
                                <input style={{ ...inputStyle, width: 70 }} type="number" min="1" value={counter} onChange={e => setCounter(Math.max(1, parseInt(e.target.value, 10) || 1))} title="Nächste Take-Nummer" />
                            </div>
                        </Field>
                    </Section>
                </div>

                {/* CENTER: live phone */}
                <div className="glass" style={{ borderRadius: 16, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
                    <div ref={stageRef} style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                        <div style={{
                            position: 'relative', width: viewW, height: viewH,
                            background: settings.transparent ? CHECKER : '#000',
                            borderRadius: 6,
                            boxShadow: recording ? `0 0 0 2px ${PINK}, 0 0 30px rgba(236,72,153,0.45)` : '0 0 0 1px rgba(249,168,212,0.5), 0 20px 50px rgba(0,0,0,0.5)'
                        }}>
                            <canvas
                                ref={canvasRef}
                                className="rec-canvas"
                                tabIndex={0}
                                onPointerDown={onPointerDown}
                                onPointerMove={onPointerMove}
                                onPointerUp={onPointerUp}
                                onKeyDown={onKeyDown}
                                onContextMenu={e => e.preventDefault()}
                                style={{ width: '100%', height: '100%', display: 'block', cursor: 'pointer', touchAction: 'none', borderRadius: 6, opacity: hasFrame && !dragSize ? 1 : 0.35 }}
                            />
                            {!hasFrame && (
                                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', opacity: 0.7, pointerEvents: 'none', textAlign: 'center', padding: 20 }}>
                                    {srv?.error ? 'Virtuelles Handy konnte nicht gestartet werden.' : 'Verbinde mit dem virtuellen Handy auf dem Server…'}
                                </div>
                            )}
                            {!recording && (
                                <div onPointerDown={onHandleDown} title="Ziehen zum Ändern der Bildschirmgröße"
                                    style={{ position: 'absolute', right: -22, bottom: -22, width: 18, height: 18, borderRadius: 6, background: PINK_GRADIENT, cursor: 'nwse-resize', boxShadow: '0 2px 8px rgba(0,0,0,0.4)', touchAction: 'none' }} />
                            )}
                            {takeRec && (
                                <div style={{ position: 'absolute', top: -26, left: 0, right: 0, textAlign: 'center', fontSize: '0.75rem', color: PINK_LIGHT, pointerEvents: 'none' }}>
                                    <span style={{ animation: 'recBlink 1s infinite' }}>●</span> Zeiger wird aufgezeichnet
                                </div>
                            )}
                        </div>
                    </div>
                    <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', fontSize: '0.78rem' }}>
                        <span style={{ opacity: 0.6 }}>Live-Vorschau vom Server · Klicken, Ziehen, Scrollen und Tippen werden ans virtuelle Handy gesendet.</span>
                        <div style={{ flex: 1 }} />
                        <button style={btn()} onClick={() => socket.emit('rec:reload')} disabled={recording}><RotateCcw size={12} /> App neu laden</button>
                        <button style={btn()} onClick={() => set({ w: preset.w, h: preset.h })} disabled={recording}><Maximize2 size={12} /> Gerätegröße</button>
                    </div>
                </div>

                {/* RIGHT */}
                <div className="rec-scroll" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
                    <Section title="Zeiger-Aufnahme" icon={<MousePointer2 size={14} />}
                        right={
                            <div style={{ display: 'flex', gap: 4 }}>
                                <input ref={importRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={importTakes} />
                                <button style={btn('ghost', { padding: '3px 8px', fontSize: '0.7rem' })} onClick={() => importRef.current?.click()}>Import</button>
                                <button style={btn('ghost', { padding: '3px 8px', fontSize: '0.7rem' })} onClick={exportTakes} disabled={!takes.length}>Export</button>
                            </div>
                        }>
                        {!takeRec ? (
                            <button style={btn('ghost', { borderColor: PINK })} onClick={startTakeRec}><Circle size={12} fill={PINK} color={PINK} /> Zeiger aufnehmen</button>
                        ) : (
                            <button style={btn('pink', { animation: 'recPulse 1.4s infinite' })} onClick={stopTakeRec}><Square size={12} fill="white" /> Zeiger-Aufnahme stoppen</button>
                        )}
                        <div style={{ fontSize: '0.7rem', opacity: 0.5, lineHeight: 1.4 }}>
                            Bewegung einmal aufnehmen und beliebig oft rendern – z. B. denselben Swipe mit verschiedenen Profilen: Profil im Control Center wählen, dann „Rendern“. Gerendert wird immer ab frisch geladener App.
                        </div>

                        {takes.map(t => {
                            const active = t.id === activeTakeId;
                            return (
                                <div key={t.id} onClick={() => setActiveTakeId(t.id)}
                                    style={{ padding: '8px 10px', borderRadius: 10, cursor: 'pointer', background: active ? 'rgba(236,72,153,0.15)' : 'rgba(255,255,255,0.04)', border: active ? `1px solid ${PINK}` : '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</div>
                                        <div style={{ fontSize: '0.7rem', opacity: 0.55 }}>{(t.duration / 1000).toFixed(2)} s · {t.events.length} Events</div>
                                    </div>
                                    <button style={btn('ghost', { padding: 5 })} title="Live abspielen" onClick={(e) => { e.stopPropagation(); socket.emit('rec:play_take', { take: t }); }}><Play size={12} /></button>
                                    <button style={btn('pink', { padding: '5px 8px', fontSize: '0.72rem' })} title="Als Video rendern" onClick={(e) => { e.stopPropagation(); renderTake(t); }}><Clapperboard size={12} /> Rendern</button>
                                    <button style={btn('ghost', { padding: 5 })} title="Umbenennen" onClick={(e) => { e.stopPropagation(); const n = prompt('Name:', t.name); if (n) setTakes(l => l.map(x => x.id === t.id ? { ...x, name: n } : x)); }}><Edit2 size={12} /></button>
                                    <button style={btn('ghost', { padding: 5 })} title="Löschen" onClick={(e) => { e.stopPropagation(); if (confirm(`„${t.name}“ löschen?`)) setTakes(l => l.filter(x => x.id !== t.id)); }}><Trash2 size={12} /></button>
                                </div>
                            );
                        })}

                        {takeSizeMismatch && (
                            <div style={{ fontSize: '0.72rem', color: '#fbbf24' }}>
                                „{activeTake.name}“ wurde bei {activeTake.viewport.w}×{activeTake.viewport.h} aufgenommen und wird auch in dieser Layout-Größe gerendert.
                            </div>
                        )}

                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <Field label={`Vorlauf vor der Bewegung: ${settings.leadIn} ms`}>
                                <input type="range" min="0" max="5000" step="100" value={settings.leadIn} onChange={e => set({ leadIn: parseInt(e.target.value, 10) })} style={{ accentColor: PINK }} />
                            </Field>
                            <Field label={`Nachlauf nach der Bewegung: ${settings.tail} ms`}>
                                <input type="range" min="0" max="10000" step="100" value={settings.tail} onChange={e => set({ tail: parseInt(e.target.value, 10) })} style={{ accentColor: PINK }} />
                            </Field>
                        </div>
                    </Section>

                    <Section title="Aufnahmen" icon={<Download size={14} />}>
                        {recordings.length === 0 && <div style={{ fontSize: '0.8rem', opacity: 0.5 }}>Noch keine Aufnahmen.</div>}
                        {recordings.map(r => (
                            <div key={r.id} style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
                                        <div style={{ fontSize: '0.7rem', opacity: 0.55 }}>
                                            {(r.formatLabel || r.format).replace(/\s*\(.*\)$/, '')} · {r.fps} fps · {(r.durationMs / 1000).toFixed(1)} s
                                            {r.width ? ` · ${r.width}×${r.height}` : r.viewport ? ` · ${Math.round(r.viewport.w * r.viewport.dpr)}×${Math.round(r.viewport.h * r.viewport.dpr)}` : ''}
                                            {r.size ? ` · ${fmtBytes(r.size)}` : ''}
                                            {r.transparent && typeof r.transparentPct === 'number' && (
                                                <span style={{ color: r.transparentPct > 0 ? '#86efac' : '#fbbf24' }}>
                                                    {r.transparentPct > 0 ? ` · Alpha: ${r.transparentPct} % transparent` : ' · ⚠ Alpha komplett deckend'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {r.status === 'done' && r.file && (
                                        <a href={`/uploads/recordings/${encodeURIComponent(r.file)}`} download={r.file} style={{ ...btn('pink', { padding: 6 }), textDecoration: 'none' }} title="Herunterladen"><Download size={13} /></a>
                                    )}
                                    <button style={btn('ghost', { padding: 6 })} title="Löschen" onClick={() => deleteRecording(r)}><Trash2 size={13} /></button>
                                </div>
                                {(r.status === 'queued' || r.status === 'processing') && (
                                    <div>
                                        <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                                            <div style={{ height: '100%', width: `${Math.round((r.progress || 0) * 100)}%`, background: PINK_GRADIENT, transition: 'width 0.4s' }} />
                                        </div>
                                        <div style={{ fontSize: '0.68rem', opacity: 0.6, marginTop: 3 }}>
                                            {r.status === 'queued' ? 'In Warteschlange…' : `Rendere Frames… ${Math.round((r.progress || 0) * 100)}%`}
                                        </div>
                                    </div>
                                )}
                                {r.status === 'error' && <div style={{ fontSize: '0.7rem', color: '#fca5a5', whiteSpace: 'pre-wrap' }}>Fehler: {r.error}</div>}
                            </div>
                        ))}
                    </Section>
                </div>
            </div>
        </div>
    );
}
