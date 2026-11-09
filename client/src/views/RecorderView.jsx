import { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import {
    Circle, Square, MousePointer2, Play, Download, Trash2, Monitor, Maximize2,
    Lock, Unlock, Film, Upload, Edit2, Smartphone, X
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

// CSS viewport size + native pixel resolution of common phones
const PRESETS = [
    { id: 'iphone16pro', label: 'iPhone 16 Pro', cssW: 402, cssH: 874, nativeW: 1206, nativeH: 2622 },
    { id: 'iphone16', label: 'iPhone 16 / 15 Pro', cssW: 393, cssH: 852, nativeW: 1179, nativeH: 2556 },
    { id: 'iphone16promax', label: 'iPhone 16 Pro Max', cssW: 440, cssH: 956, nativeW: 1320, nativeH: 2868 },
    { id: 'iphone13mini', label: 'iPhone 13 mini', cssW: 375, cssH: 812, nativeW: 1080, nativeH: 2340 },
    { id: 'iphonese', label: 'iPhone SE', cssW: 375, cssH: 667, nativeW: 750, nativeH: 1334 },
    { id: 'pixel8', label: 'Google Pixel 8', cssW: 412, cssH: 915, nativeW: 1080, nativeH: 2400 },
    { id: 'galaxys24', label: 'Samsung Galaxy S24', cssW: 360, cssH: 780, nativeW: 1080, nativeH: 2340 },
    { id: 'hd916', label: '9:16 (1080 × 1920)', cssW: 360, cssH: 640, nativeW: 1080, nativeH: 1920 },
    { id: 'free', label: 'Frei (beliebiges Format)', cssW: 400, cssH: 800, nativeW: null, nativeH: null }
];

const FPS_FALLBACK = ['23.976', '24', '25', '29.97', '30', '50', '59.94', '60'];

// Intermediate browser codec (MediaRecorder). The server transcodes this into the delivery format.
const MIME_CANDIDATES = [
    { mime: 'video/webm;codecs=h264', label: 'H.264 in WebM (Hardware, empfohlen)', ext: 'webm' },
    { mime: 'video/mp4;codecs=avc1.640034', label: 'H.264 in MP4', ext: 'mp4' },
    { mime: 'video/webm;codecs=vp9', label: 'VP9 in WebM', ext: 'webm' },
    { mime: 'video/webm;codecs=vp8', label: 'VP8 in WebM', ext: 'webm' },
    { mime: 'video/webm', label: 'WebM (Standard)', ext: 'webm' }
];

const PINK = '#ec4899';
const PINK_LIGHT = '#f9a8d4';
const PINK_GRADIENT = 'linear-gradient(135deg, #f472b6 0%, #ec4899 55%, #db2777 100%)';

const DEFAULT_SETTINGS = {
    format: 'prores_hq',
    fps: '30',
    bitrate: 80,
    mime: '',
    target: 'native', // 'native' | 'device' | 'custom'
    customW: 1080,
    customH: 1920,
    keepRaw: false,
    backdrop: '#000000',
    namePrefix: 'Take',
    autoPlayPointer: false,
    autoPlayDelay: 500,
    autoStop: true,
    autoStopTail: 1000,
    showGhost: false
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
            // merge new default keys into stored objects
            if (initial && typeof initial === 'object' && !Array.isArray(initial) && parsed && typeof parsed === 'object') {
                return { ...initial, ...parsed };
            }
            return parsed;
        } catch {
            return initial;
        }
    });
    useEffect(() => {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full / disabled */ }
    }, [key, value]);
    return [value, setValue];
}

const fmtTime = (ms) => {
    const s = Math.max(0, ms) / 1000;
    const m = Math.floor(s / 60);
    return `${String(m).padStart(2, '0')}:${(s % 60).toFixed(1).padStart(4, '0')}`;
};

const fmtBytes = (b) => {
    if (!b) return '';
    if (b > 1e9) return `${(b / 1e9).toFixed(2)} GB`;
    return `${(b / 1e6).toFixed(1)} MB`;
};

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// ---------------------------------------------------------------------------
// Small UI pieces
// ---------------------------------------------------------------------------

const panelStyle = {
    padding: 16,
    borderRadius: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 12
};

const inputStyle = {
    width: '100%',
    padding: '8px 10px',
    borderRadius: 8,
    background: 'rgba(0,0,0,0.35)',
    color: 'white',
    border: '1px solid rgba(255,255,255,0.12)',
    fontFamily: 'inherit',
    fontSize: '0.85rem',
    outline: 'none'
};

const btn = (variant = 'ghost', extra = {}) => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '7px 12px',
    borderRadius: 10,
    border: variant === 'ghost' ? '1px solid rgba(255,255,255,0.14)' : 'none',
    background: variant === 'pink' ? PINK_GRADIENT
        : variant === 'danger' ? 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)'
            : 'rgba(255,255,255,0.06)',
    color: 'white',
    fontFamily: 'inherit',
    fontSize: '0.82rem',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    ...extra
});

function Section({ title, icon, children, right }) {
    return (
        <div className="glass" style={panelStyle}>
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
            {hint && <span style={{ fontSize: '0.68rem', opacity: 0.45 }}>{hint}</span>}
        </label>
    );
}

function Check({ checked, onChange, children, disabled }) {
    return (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1 }}>
            <input type="checkbox" checked={!!checked} disabled={disabled} onChange={e => onChange(e.target.checked)} style={{ accentColor: PINK }} />
            {children}
        </label>
    );
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

export default function RecorderView({ socket }) {
    const iframeRef = useRef(null);
    const stageRef = useRef(null);
    const probeRef = useRef(null);

    // --- Stage / device frame ---
    const [presetId, setPresetId] = usePersistentState('recorder_preset', 'iphone16pro');
    const preset = PRESETS.find(p => p.id === presetId) || PRESETS[0];
    const aspect = preset.nativeW ? preset.nativeW / preset.nativeH : null;
    const [size, setSize] = usePersistentState('recorder_size', null); // CSS px {w,h}
    const [lockAspect, setLockAspect] = usePersistentState('recorder_lock_aspect', true);
    const [dpr, setDpr] = useState(window.devicePixelRatio || 1);
    const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
    const [resizing, setResizing] = useState(false);

    // --- Recording settings ---
    const [settings, setSettings] = usePersistentState('recorder_settings', DEFAULT_SETTINGS);
    const set = (patch) => setSettings(s => ({ ...s, ...patch }));
    const [counter, setCounter] = usePersistentState('recorder_counter', 1);

    // --- Capture state ---
    const [caps, setCaps] = useState(null);
    const [armed, setArmed] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const [captureSize, setCaptureSize] = useState(null);
    const [uploads, setUploads] = useState([]); // [{id, name, pct}]
    const [error, setError] = useState(null);
    const [fallbackDownload, setFallbackDownload] = useState(null); // {url, filename}
    const [recordings, setRecordings] = useState([]);

    const streamRef = useRef(null);
    const recorderRef = useRef(null);
    const recStartRef = useRef(0);
    const timerRef = useRef(null);
    const autoTimersRef = useRef([]);

    // --- Pointer takes ---
    const [takes, setTakes] = usePersistentState('recorder_pointer_takes', []);
    const [activeTakeId, setActiveTakeId] = usePersistentState('recorder_active_take', null);
    const activeTake = takes.find(t => t.id === activeTakeId) || null;
    const [pointerRec, setPointerRec] = useState(false);
    const [playing, setPlaying] = useState(null); // take id
    const [playPos, setPlayPos] = useState(0);
    const [ghost, setGhost] = useState(null);
    const pointerEventsRef = useRef([]);
    const pointerListenersRef = useRef(null);
    const playRef = useRef(null);
    const importRef = useRef(null);
    const takesRef = useRef(takes);
    takesRef.current = takes;

    const supportedMimes = useMemo(
        () => MIME_CANDIDATES.filter(c => window.MediaRecorder && MediaRecorder.isTypeSupported(c.mime)),
        []
    );
    const mimeInfo = supportedMimes.find(m => m.mime === settings.mime) || supportedMimes[0] || null;
    const supportsRegionCapture = typeof window !== 'undefined' && 'CropTarget' in window && !!navigator.mediaDevices?.getDisplayMedia;

    // -----------------------------------------------------------------------
    // Effects
    // -----------------------------------------------------------------------

    useEffect(() => {
        document.title = 'Screen Recorder';
        document.body.style.backgroundColor = '#0f172a';
        document.documentElement.style.backgroundColor = '#0f172a';
    });

    // Device pixel ratio changes with browser zoom or moving to another monitor
    useEffect(() => {
        const update = () => setDpr(window.devicePixelRatio || 1);
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, []);

    // Track stage size
    useEffect(() => {
        if (!stageRef.current) return;
        const ro = new ResizeObserver(([entry]) => {
            setStageSize({ w: entry.contentRect.width, h: entry.contentRect.height });
        });
        ro.observe(stageRef.current);
        return () => ro.disconnect();
    }, []);

    // Initial fit
    useEffect(() => {
        if (!size && stageSize.h > 0) fitToStage();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stageSize.h]);

    // Server capabilities + existing recordings
    useEffect(() => {
        axios.get('/api/recordings/capabilities').then(r => setCaps(r.data)).catch(() => setCaps({ ffmpeg: false, formats: [], fps: FPS_FALLBACK }));
        axios.get('/api/recordings').then(r => setRecordings(r.data)).catch(() => { });
    }, []);

    // Live transcode progress
    useEffect(() => {
        const onJob = (job) => setRecordings(list => {
            const i = list.findIndex(r => r.id === job.id);
            if (i === -1) return [job, ...list];
            const copy = [...list];
            copy[i] = job;
            return copy;
        });
        const onDeleted = ({ id }) => setRecordings(list => list.filter(r => r.id !== id));
        socket.on('recorder:job', onJob);
        socket.on('recorder:job_deleted', onDeleted);
        return () => {
            socket.off('recorder:job', onJob);
            socket.off('recorder:job_deleted', onDeleted);
        };
    }, [socket]);

    // Escape stops pointer recording / playback
    useEffect(() => {
        const onKey = (e) => {
            if (e.key !== 'Escape') return;
            if (pointerListenersRef.current) stopPointerRec();
            if (playRef.current) stopPlayback();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    });

    // Warn before leaving while recording or uploading
    useEffect(() => {
        const onBeforeUnload = (e) => {
            if (isRecording || uploads.length) { e.preventDefault(); e.returnValue = ''; }
        };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, [isRecording, uploads.length]);

    // Cleanup on unmount
    useEffect(() => () => {
        streamRef.current?.getTracks().forEach(t => t.stop());
        if (playRef.current) cancelAnimationFrame(playRef.current.raf);
        clearInterval(timerRef.current);
    }, []);

    // If the selected format isn't available on the server, fall back
    useEffect(() => {
        if (caps?.formats?.length && !caps.formats.find(f => f.key === settings.format)) {
            set({ format: caps.formats[0].key });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [caps]);

    // -----------------------------------------------------------------------
    // Stage sizing
    // -----------------------------------------------------------------------

    const STAGE_PAD = 48;
    const cur = size || { w: preset.cssW, h: preset.cssH };
    const sizeRef = useRef(cur);
    sizeRef.current = cur;
    const pxW = Math.round(cur.w * dpr);
    const pxH = Math.round(cur.h * dpr);
    const overflows = stageSize.w > 0 && (cur.w + 2 > stageSize.w || cur.h + 2 > stageSize.h);

    function fitToStage(p = preset) {
        const a = p.nativeW ? p.nativeW / p.nativeH : (cur.w / cur.h);
        const maxW = Math.max(160, stageSize.w - STAGE_PAD * 2);
        const maxH = Math.max(200, stageSize.h - STAGE_PAD * 2);
        let h = maxH;
        let w = h * a;
        if (w > maxW) { w = maxW; h = w / a; }
        setSize({ w: Math.round(w), h: Math.round(h) });
    }

    function setDeviceOneToOne() {
        if (!preset.nativeW) return;
        setSize({ w: Math.round(preset.nativeW / dpr), h: Math.round(preset.nativeH / dpr) });
    }

    function changePreset(id) {
        const p = PRESETS.find(x => x.id === id) || PRESETS[0];
        setPresetId(p.id);
        if (p.nativeW) {
            const a = p.nativeW / p.nativeH;
            let h = cur.h;
            let w = h * a;
            const maxW = stageSize.w - STAGE_PAD * 2;
            if (maxW > 0 && w > maxW) { w = maxW; h = w / a; }
            setSize({ w: Math.round(w), h: Math.round(h) });
        }
    }

    function setDim(axis, value) {
        const v = Math.max(100, parseInt(value, 10) || 0);
        if (lockAspect && aspect) {
            setSize(axis === 'w' ? { w: v, h: Math.round(v / aspect) } : { w: Math.round(v * aspect), h: v });
        } else {
            setSize({ ...cur, [axis]: v });
        }
    }

    function setPixelDim(axis, value) {
        const px = parseInt(value, 10) || 0;
        setDim(axis, Math.round(px / dpr));
    }

    const onHandleDown = (e) => {
        if (isRecording) return;
        e.preventDefault();
        const sx = e.clientX, sy = e.clientY;
        const start = { ...cur };
        setResizing(true);
        const move = (ev) => {
            // Frame is centred, so it grows on both sides: factor 2 keeps the handle under the cursor
            const dx = (ev.clientX - sx) * 2;
            const dy = (ev.clientY - sy) * 2;
            let w = Math.max(120, start.w + dx);
            let h = Math.max(160, start.h + dy);
            if (lockAspect && aspect) {
                if (Math.abs(dx) >= Math.abs(dy) * aspect) h = w / aspect; else w = h * aspect;
            }
            setSize({ w: Math.round(w), h: Math.round(h) });
        };
        const up = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
            setResizing(false);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
    };

    // -----------------------------------------------------------------------
    // Screen capture
    // -----------------------------------------------------------------------

    async function arm() {
        setError(null);
        if (!navigator.mediaDevices?.getDisplayMedia) {
            setError('Dieser Browser unterstützt keine Bildschirmaufnahme. Bitte Chrome oder Edge (Desktop) über HTTPS verwenden.');
            return false;
        }
        if (!('CropTarget' in window)) {
            setError('Region Capture wird nicht unterstützt. Bitte aktuelles Chrome oder Edge (Desktop) verwenden.');
            return false;
        }
        const fpsNum = Math.ceil(parseFloat(settings.fps));
        let stream;
        try {
            stream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    frameRate: { ideal: fpsNum, max: fpsNum },
                    width: { max: 7680 },
                    height: { max: 7680 }
                },
                audio: false,
                preferCurrentTab: true,
                selfBrowserSurface: 'include',
                surfaceSwitching: 'exclude',
                monitorTypeSurfaces: 'exclude'
            });
        } catch {
            setError('Freigabe abgebrochen.');
            return false;
        }
        const [track] = stream.getVideoTracks();
        try {
            const target = await window.CropTarget.fromElement(iframeRef.current);
            await track.cropTo(target);
        } catch (e) {
            console.error(e);
            stream.getTracks().forEach(t => t.stop());
            setError('Zuschneiden auf die Actor App fehlgeschlagen. Bitte im Freigabe-Dialog „Diesen Tab“ auswählen.');
            return false;
        }
        try { track.contentHint = 'detail'; } catch { /* optional */ }
        track.addEventListener('ended', () => disarm());

        streamRef.current = stream;
        if (probeRef.current) {
            probeRef.current.srcObject = stream;
            probeRef.current.play().catch(() => { });
        }
        setArmed(true);
        return true;
    }

    function disarm() {
        if (recorderRef.current?.state === 'recording') stopRecording();
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        if (probeRef.current) probeRef.current.srcObject = null;
        setArmed(false);
        setCaptureSize(null);
    }

    function outputTarget() {
        if (settings.target === 'device' && preset.nativeW) return { w: preset.nativeW, h: preset.nativeH };
        if (settings.target === 'custom') return { w: settings.customW, h: settings.customH };
        return null;
    }

    async function startRecording() {
        if (isRecording) return;
        if (!mimeInfo) {
            setError('MediaRecorder wird von diesem Browser nicht unterstützt.');
            return;
        }
        if (!streamRef.current) {
            const ok = await arm();
            if (!ok) return;
        }
        setFallbackDownload(null);

        const chunks = [];
        const rec = new MediaRecorder(streamRef.current, {
            mimeType: mimeInfo.mime,
            videoBitsPerSecond: settings.bitrate * 1_000_000
        });
        const name = `${settings.namePrefix || 'Take'}_${String(counter).padStart(3, '0')}`;
        setCounter(c => c + 1);
        const job = {
            name,
            mime: mimeInfo,
            format: settings.format,
            fps: settings.fps,
            keepRaw: settings.keepRaw,
            target: outputTarget()
        };

        rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
        rec.onstop = () => {
            const durationMs = performance.now() - recStartRef.current;
            const v = probeRef.current;
            finalizeRecording(chunks, job, durationMs, v ? { w: v.videoWidth, h: v.videoHeight } : null);
        };

        recorderRef.current = rec;
        rec.start(1000);
        recStartRef.current = performance.now();
        setIsRecording(true);
        setElapsed(0);
        clearInterval(timerRef.current);
        timerRef.current = setInterval(() => setElapsed(performance.now() - recStartRef.current), 100);

        // Optional: replay pointer take in sync with the recording
        if (settings.autoPlayPointer && activeTake) {
            const t = setTimeout(() => {
                playTake(activeTake, settings.autoStop ? () => {
                    const t2 = setTimeout(stopRecording, settings.autoStopTail);
                    autoTimersRef.current.push(t2);
                } : null);
            }, settings.autoPlayDelay);
            autoTimersRef.current.push(t);
        }
    }

    function stopRecording() {
        autoTimersRef.current.forEach(clearTimeout);
        autoTimersRef.current = [];
        if (playRef.current) stopPlayback();
        if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
        recorderRef.current = null;
        clearInterval(timerRef.current);
        setIsRecording(false);
    }

    async function finalizeRecording(chunks, job, durationMs, cap) {
        const blob = new Blob(chunks, { type: job.mime.mime.split(';')[0] });
        const filename = `${job.name}.${job.mime.ext}`;
        const uploadId = newId();
        setUploads(u => [...u, { id: uploadId, name: job.name, pct: 0 }]);

        const fd = new FormData();
        fd.append('settings', JSON.stringify({
            name: job.name,
            format: job.format,
            fps: job.fps,
            keepRaw: job.keepRaw,
            durationMs: Math.round(durationMs),
            captureWidth: cap?.w,
            captureHeight: cap?.h,
            targetWidth: job.target?.w,
            targetHeight: job.target?.h
        }));
        fd.append('file', blob, filename);

        try {
            await axios.post('/api/recordings', fd, {
                onUploadProgress: (ev) => {
                    const pct = ev.total ? Math.round((ev.loaded * 100) / ev.total) : 0;
                    setUploads(u => u.map(x => x.id === uploadId ? { ...x, pct } : x));
                }
            });
        } catch (e) {
            console.error(e);
            setError(`Upload fehlgeschlagen: ${e.response?.data?.error || e.message}. Die Rohdatei kann lokal gespeichert werden.`);
            setFallbackDownload({ url: URL.createObjectURL(blob), filename });
        } finally {
            setUploads(u => u.filter(x => x.id !== uploadId));
        }
    }

    // Read the real capture resolution from the stream
    const onProbeResize = () => {
        const v = probeRef.current;
        if (v && v.videoWidth) setCaptureSize({ w: v.videoWidth, h: v.videoHeight });
    };

    // -----------------------------------------------------------------------
    // Pointer recording / playback
    // -----------------------------------------------------------------------

    function startPointerRec() {
        const win = iframeRef.current?.contentWindow;
        if (!win || pointerListenersRef.current || playRef.current) return;
        pointerEventsRef.current = [];
        let t0 = null;
        const handler = (e) => {
            if (t0 === null) t0 = e.timeStamp;
            pointerEventsRef.current.push({
                t: Math.round((e.timeStamp - t0) * 10) / 10,
                type: e.type,
                x: e.clientX / win.innerWidth,
                y: e.clientY / win.innerHeight,
                button: e.button,
                buttons: e.buttons
            });
        };
        const keyHandler = (e) => { if (e.key === 'Escape') stopPointerRec(); };
        const types = ['mousedown', 'mousemove', 'mouseup', 'click'];
        types.forEach(t => win.document.addEventListener(t, handler, true));
        win.document.addEventListener('keydown', keyHandler, true);
        pointerListenersRef.current = { win, handler, keyHandler, types };
        setPointerRec(true);
    }

    function stopPointerRec() {
        const l = pointerListenersRef.current;
        if (!l) return;
        try {
            l.types.forEach(t => l.win.document.removeEventListener(t, l.handler, true));
            l.win.document.removeEventListener('keydown', l.keyHandler, true);
        } catch { /* iframe reloaded */ }
        pointerListenersRef.current = null;
        setPointerRec(false);

        let evs = pointerEventsRef.current;
        // Start at the first press (hover before it is irrelevant) ...
        const firstDown = evs.findIndex(e => e.type === 'mousedown');
        if (firstDown > 0) {
            const base = evs[firstDown].t;
            evs = evs.slice(firstDown).map(e => ({ ...e, t: Math.round((e.t - base) * 10) / 10 }));
        }
        // ... and end at the last press/release/click (moving out to the Stop button is irrelevant)
        let last = evs.length - 1;
        while (last >= 0 && evs[last].type === 'mousemove') last--;
        if (last >= 0) evs = evs.slice(0, last + 1);
        if (!evs.length) return;

        const take = {
            id: newId(),
            name: `Zeiger ${takesRef.current.length + 1}`,
            createdAt: Date.now(),
            duration: evs[evs.length - 1].t,
            width: sizeRef.current.w,
            height: sizeRef.current.h,
            events: evs
        };
        setTakes(list => [...list, take]);
        setActiveTakeId(take.id);
    }

    function dispatchPointer(win, ev) {
        const doc = win.document;
        const x = ev.x * win.innerWidth;
        const y = ev.y * win.innerHeight;
        const target = doc.elementFromPoint(x, y) || doc.body;
        const init = {
            bubbles: true, cancelable: true, composed: true, view: win,
            clientX: x, clientY: y, screenX: x, screenY: y,
            button: ev.button ?? 0, buttons: ev.buttons ?? 0
        };
        const pointerType = { mousedown: 'pointerdown', mousemove: 'pointermove', mouseup: 'pointerup' }[ev.type];
        if (pointerType && win.PointerEvent) {
            target.dispatchEvent(new win.PointerEvent(pointerType, { ...init, pointerId: 1, pointerType: 'mouse', isPrimary: true }));
        }
        target.dispatchEvent(new win.MouseEvent(ev.type, init));
        if (settings.showGhost) {
            const down = ev.type === 'mousedown' || (ev.type === 'mousemove' && (ev.buttons & 1) === 1);
            setGhost({ x: ev.x, y: ev.y, down });
        }
    }

    function playTake(take, onDone) {
        const win = iframeRef.current?.contentWindow;
        if (!win || !take?.events?.length || pointerListenersRef.current) return;
        if (playRef.current) stopPlayback();
        let i = 0;
        const start = performance.now();
        setPlaying(take.id);
        setPlayPos(0);
        const state = { raf: 0, lastUi: 0 };
        playRef.current = state;
        const step = () => {
            const now = performance.now() - start;
            while (i < take.events.length && take.events[i].t <= now) {
                try { dispatchPointer(win, take.events[i]); } catch (e) { console.error(e); }
                i++;
            }
            if (now - state.lastUi > 100) { state.lastUi = now; setPlayPos(Math.min(1, now / (take.duration || 1))); }
            if (i < take.events.length) {
                state.raf = requestAnimationFrame(step);
            } else {
                playRef.current = null;
                setPlaying(null);
                setPlayPos(1);
                setTimeout(() => setGhost(null), 400);
                onDone?.();
            }
        };
        state.raf = requestAnimationFrame(step);
    }

    function stopPlayback() {
        if (playRef.current) cancelAnimationFrame(playRef.current.raf);
        playRef.current = null;
        setPlaying(null);
        setGhost(null);
    }

    function renameTake(take) {
        const name = prompt('Name für Zeiger-Aufnahme:', take.name);
        if (name) setTakes(list => list.map(t => t.id === take.id ? { ...t, name } : t));
    }

    function deleteTake(take) {
        if (!confirm(`„${take.name}“ löschen?`)) return;
        setTakes(list => list.filter(t => t.id !== take.id));
        if (activeTakeId === take.id) setActiveTakeId(null);
    }

    function exportTakes() {
        const blob = new Blob([JSON.stringify(takes, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
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
            const valid = arr.filter(t => Array.isArray(t.events)).map(t => ({ ...t, id: newId() }));
            setTakes(list => [...list, ...valid]);
        }).catch(err => alert(`Import fehlgeschlagen: ${err.message}`));
        e.target.value = '';
    }

    async function deleteRecording(r) {
        if (!confirm(`„${r.name}“ vom Server löschen?`)) return;
        try {
            await axios.delete(`/api/recordings/${r.id}`);
            setRecordings(list => list.filter(x => x.id !== r.id));
        } catch (e) {
            alert(`Löschen fehlgeschlagen: ${e.message}`);
        }
    }

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------

    const formats = caps?.formats?.length ? caps.formats : [{ key: 'raw', label: 'Original Browser-Aufnahme (kein Transcode)' }];
    const fpsOptions = caps?.fps?.length ? caps.fps : FPS_FALLBACK;
    const target = outputTarget();
    const takeSizeMismatch = activeTake && activeTake.width && (Math.abs(activeTake.width - cur.w) > 2 || Math.abs(activeTake.height - cur.h) > 2);
    const locked = isRecording;

    return (
        <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#0f172a', color: 'white', userSelect: resizing ? 'none' : 'auto' }}>
            <style>{`
                @keyframes recPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(236,72,153,0.7); } 50% { box-shadow: 0 0 0 10px rgba(236,72,153,0); } }
                @keyframes recBlink { 0%,100% { opacity: 1 } 50% { opacity: 0.25 } }
                .rec-scroll::-webkit-scrollbar { width: 8px; }
                .rec-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 4px; }
                .rec-select option { background: #1e293b; }
            `}</style>

            {/* HIDDEN STREAM PROBE (reads the real capture resolution) */}
            <video ref={probeRef} muted playsInline onResize={onProbeResize} onLoadedMetadata={onProbeResize}
                style={{ position: 'fixed', width: 2, height: 2, opacity: 0, pointerEvents: 'none', left: -10, top: -10 }} />

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

                {/* Capture status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: armed ? '#22c55e' : '#64748b' }} />
                    {armed ? 'Tab-Freigabe aktiv' : 'Keine Freigabe'}
                    {armed && !isRecording && (
                        <button style={btn('ghost', { padding: '4px 8px' })} onClick={disarm} title="Freigabe beenden"><X size={12} /></button>
                    )}
                    {!armed && (
                        <button style={btn('ghost', { padding: '4px 10px' })} onClick={arm} disabled={!supportsRegionCapture}>Freigabe vorbereiten</button>
                    )}
                </div>

                {uploads.map(u => (
                    <div key={u.id} style={{ fontSize: '0.78rem', opacity: 0.85, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Upload size={12} /> {u.name} {u.pct}%
                    </div>
                ))}

                {/* RECORD BUTTON */}
                {!isRecording ? (
                    <button
                        onClick={startRecording}
                        disabled={!supportsRegionCapture}
                        style={btn('pink', { padding: '10px 22px', fontSize: '0.95rem', borderRadius: 999, opacity: supportsRegionCapture ? 1 : 0.4 })}
                    >
                        <Circle size={16} fill="white" /> REC
                    </button>
                ) : (
                    <button
                        onClick={stopRecording}
                        style={btn('pink', { padding: '10px 22px', fontSize: '0.95rem', borderRadius: 999, animation: 'recPulse 1.4s infinite', fontVariantNumeric: 'tabular-nums' })}
                    >
                        <Square size={14} fill="white" /> STOP <span style={{ marginLeft: 6, animation: 'recBlink 1s infinite' }}>●</span> {fmtTime(elapsed)}
                    </button>
                )}
            </div>

            {/* WARNINGS */}
            {(!supportsRegionCapture || (caps && !caps.ffmpeg) || error) && (
                <div style={{ margin: '8px 12px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {!supportsRegionCapture && (
                        <div style={{ padding: '8px 12px', borderRadius: 10, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', fontSize: '0.82rem' }}>
                            Aufnahme benötigt <b>Chrome oder Edge (Desktop, ab Version 104)</b> und eine HTTPS-Verbindung. Vorschau und Zeiger-Aufnahme funktionieren trotzdem.
                        </div>
                    )}
                    {caps && !caps.ffmpeg && (
                        <div style={{ padding: '8px 12px', borderRadius: 10, background: 'rgba(234,179,8,0.15)', border: '1px solid rgba(234,179,8,0.4)', fontSize: '0.82rem' }}>
                            ffmpeg ist auf dem Server nicht installiert – ProRes-Export ist deaktiviert, nur die Original-Browseraufnahme ist verfügbar.
                        </div>
                    )}
                    {error && (
                        <div style={{ padding: '8px 12px', borderRadius: 10, background: 'rgba(236,72,153,0.15)', border: '1px solid rgba(236,72,153,0.4)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ flex: 1 }}>{error}</span>
                            {fallbackDownload && (
                                <a href={fallbackDownload.url} download={fallbackDownload.filename} style={{ ...btn('pink'), textDecoration: 'none' }}><Download size={14} /> Lokal speichern</a>
                            )}
                            <button style={btn('ghost', { padding: '4px 8px' })} onClick={() => { setError(null); setFallbackDownload(null); }}><X size={12} /></button>
                        </div>
                    )}
                </div>
            )}

            {/* BODY */}
            <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '300px 1fr 330px', gap: 12, padding: 12 }}>

                {/* LEFT: FORMAT + STAGE SETTINGS */}
                <div className="rec-scroll" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
                    <Section title="Aufnahmeformat" icon={<Film size={14} />}>
                        <Field label="Codec / Container">
                            <select className="rec-select" style={inputStyle} value={settings.format} disabled={locked} onChange={e => set({ format: e.target.value })}>
                                {formats.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                            </select>
                        </Field>
                        <Field label="Bildrate (fps)" hint="Die Browseraufnahme wird beim Export auf eine konstante Bildrate gebracht.">
                            <select className="rec-select" style={inputStyle} value={settings.fps} disabled={locked || armed} onChange={e => set({ fps: e.target.value })}>
                                {fpsOptions.map(f => <option key={f} value={f}>{f} fps</option>)}
                            </select>
                        </Field>
                        <Field label="Ausgabe-Auflösung">
                            <select className="rec-select" style={inputStyle} value={settings.target} disabled={locked} onChange={e => set({ target: e.target.value })}>
                                <option value="native">Nativ (wie aufgenommen)</option>
                                {preset.nativeW && <option value="device">Geräteauflösung {preset.nativeW} × {preset.nativeH}</option>}
                                <option value="custom">Benutzerdefiniert</option>
                            </select>
                        </Field>
                        {settings.target === 'custom' && (
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <input style={inputStyle} type="number" value={settings.customW} disabled={locked} onChange={e => set({ customW: parseInt(e.target.value, 10) || 0 })} />
                                <span style={{ opacity: 0.5 }}>×</span>
                                <input style={inputStyle} type="number" value={settings.customH} disabled={locked} onChange={e => set({ customH: parseInt(e.target.value, 10) || 0 })} />
                            </div>
                        )}
                        <Field label="Clip-Name">
                            <div style={{ display: 'flex', gap: 6 }}>
                                <input style={inputStyle} value={settings.namePrefix} disabled={locked} onChange={e => set({ namePrefix: e.target.value })} />
                                <input style={{ ...inputStyle, width: 70 }} type="number" min="1" value={counter} disabled={locked} onChange={e => setCounter(Math.max(1, parseInt(e.target.value, 10) || 1))} title="Nächste Take-Nummer" />
                            </div>
                        </Field>
                        <Check checked={settings.keepRaw} disabled={locked} onChange={v => set({ keepRaw: v })}>Original-Browseraufnahme zusätzlich behalten</Check>

                        <details>
                            <summary style={{ fontSize: '0.78rem', opacity: 0.7, cursor: 'pointer' }}>Erweitert (Zwischencodec)</summary>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                                <Field label="Browser-Codec (Zwischenaufnahme)">
                                    <select className="rec-select" style={inputStyle} value={mimeInfo?.mime || ''} disabled={locked} onChange={e => set({ mime: e.target.value })}>
                                        {supportedMimes.map(m => <option key={m.mime} value={m.mime}>{m.label}</option>)}
                                    </select>
                                </Field>
                                <Field label={`Bitrate Zwischenaufnahme: ${settings.bitrate} Mbit/s`} hint="Höher = weniger Kompressionsartefakte vor dem ProRes-Export.">
                                    <input type="range" min="10" max="250" step="10" value={settings.bitrate} disabled={locked} onChange={e => set({ bitrate: parseInt(e.target.value, 10) })} style={{ accentColor: PINK }} />
                                </Field>
                            </div>
                        </details>
                    </Section>

                    <Section title="Bühne / Gerät" icon={<Smartphone size={14} />}>
                        <Field label="Gerät / Seitenverhältnis">
                            <select className="rec-select" style={inputStyle} value={presetId} disabled={locked} onChange={e => changePreset(e.target.value)}>
                                {PRESETS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                            </select>
                        </Field>
                        <Field label="Größe in Pixel (Aufnahme)">
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <input style={inputStyle} type="number" value={pxW} disabled={locked} onChange={e => setPixelDim('w', e.target.value)} />
                                <span style={{ opacity: 0.5 }}>×</span>
                                <input style={inputStyle} type="number" value={pxH} disabled={locked} onChange={e => setPixelDim('h', e.target.value)} />
                                <button
                                    style={btn('ghost', { padding: '7px 8px', borderColor: lockAspect && aspect ? PINK : undefined })}
                                    disabled={!aspect}
                                    onClick={() => setLockAspect(v => !v)}
                                    title={lockAspect ? 'Seitenverhältnis gesperrt' : 'Seitenverhältnis frei'}
                                >
                                    {lockAspect && aspect ? <Lock size={14} /> : <Unlock size={14} />}
                                </button>
                            </div>
                        </Field>
                        <div style={{ display: 'flex', gap: 6 }}>
                            <button style={btn('ghost', { flex: 1 })} disabled={locked} onClick={() => fitToStage()}><Maximize2 size={14} /> Einpassen</button>
                            <button style={btn('ghost', { flex: 1 })} disabled={locked || !preset.nativeW} onClick={setDeviceOneToOne} title="Pixelgenau auf die native Geräteauflösung setzen">1:1 Gerät</button>
                        </div>
                        <Field label="Hintergrund hinter der Actor App" hint="Sichtbar, wenn der App-Hintergrund transparent ist (z. B. Grün für Keying). Wird mit aufgenommen.">
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <input type="color" value={settings.backdrop} onChange={e => set({ backdrop: e.target.value })} style={{ width: 36, height: 30, border: 'none', background: 'none', padding: 0, cursor: 'pointer' }} />
                                {['#000000', '#ffffff', '#00ff00', '#0000ff'].map(c => (
                                    <button key={c} onClick={() => set({ backdrop: c })} title={c}
                                        style={{ width: 24, height: 24, borderRadius: 6, background: c, border: settings.backdrop === c ? `2px solid ${PINK}` : '1px solid rgba(255,255,255,0.25)', cursor: 'pointer' }} />
                                ))}
                            </div>
                        </Field>
                    </Section>
                </div>

                {/* CENTER: STAGE */}
                <div className="glass" style={{ borderRadius: 16, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
                    <div ref={stageRef} style={{
                        flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', position: 'relative',
                        background: 'repeating-conic-gradient(rgba(255,255,255,0.025) 0% 25%, transparent 0% 50%) 50% / 24px 24px'
                    }}>
                        <div style={{ margin: 'auto', padding: STAGE_PAD, flexShrink: 0 }}>
                            <div style={{
                                position: 'relative',
                                width: cur.w,
                                height: cur.h,
                                background: settings.backdrop,
                                // ring is outside the iframe box, so it is not part of the cropped capture
                                boxShadow: isRecording
                                    ? `0 0 0 2px ${PINK}, 0 0 30px rgba(236,72,153,0.45)`
                                    : `0 0 0 1px rgba(249,168,212,0.5), 0 20px 50px rgba(0,0,0,0.5)`
                            }}>
                                <iframe
                                    ref={iframeRef}
                                    src="/app"
                                    title="Actor App"
                                    allow="autoplay; microphone; geolocation"
                                    style={{
                                        position: 'absolute', inset: 0, width: '100%', height: '100%',
                                        border: 'none', display: 'block', background: 'transparent',
                                        colorScheme: 'normal',
                                        pointerEvents: resizing ? 'none' : 'auto'
                                    }}
                                />

                                {/* Blocks real mouse input while a pointer take is replayed (invisible in capture) */}
                                {playing && <div style={{ position: 'absolute', inset: 0, cursor: 'not-allowed' }} />}

                                {/* Optional ghost touch indicator */}
                                {ghost && settings.showGhost && (
                                    <div style={{
                                        position: 'absolute',
                                        left: ghost.x * cur.w, top: ghost.y * cur.h,
                                        width: ghost.down ? 34 : 26, height: ghost.down ? 34 : 26,
                                        transform: 'translate(-50%, -50%)',
                                        borderRadius: '50%',
                                        background: ghost.down ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.2)',
                                        border: '2px solid rgba(255,255,255,0.8)',
                                        pointerEvents: 'none',
                                        transition: 'width 0.1s, height 0.1s, background 0.1s'
                                    }} />
                                )}

                                {/* Resize handle (outside the capture area) */}
                                {!locked && (
                                    <div
                                        onPointerDown={onHandleDown}
                                        title="Ziehen zum Skalieren"
                                        style={{
                                            position: 'absolute', right: -22, bottom: -22, width: 18, height: 18,
                                            borderRadius: 6, background: PINK_GRADIENT, cursor: 'nwse-resize',
                                            boxShadow: '0 2px 8px rgba(0,0,0,0.4)', touchAction: 'none'
                                        }}
                                    />
                                )}

                                {pointerRec && (
                                    <div style={{
                                        position: 'absolute', top: -30, left: 0, right: 0, textAlign: 'center',
                                        fontSize: '0.75rem', color: PINK_LIGHT, pointerEvents: 'none'
                                    }}>
                                        <span style={{ animation: 'recBlink 1s infinite' }}>●</span> Zeiger wird aufgezeichnet – Esc zum Beenden
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Resolution readout */}
                    <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', fontVariantNumeric: 'tabular-nums' }}>
                        <div>
                            <div style={{ fontSize: '0.68rem', opacity: 0.55, textTransform: 'uppercase', letterSpacing: 0.5 }}>Pixelauflösung</div>
                            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: PINK_LIGHT }}>{pxW} × {pxH} px</div>
                        </div>
                        <div style={{ fontSize: '0.78rem', opacity: 0.7, lineHeight: 1.5 }}>
                            <div>CSS {cur.w} × {cur.h} · DPR {Math.round(dpr * 100) / 100}</div>
                            {captureSize && <div>Stream: {captureSize.w} × {captureSize.h} px</div>}
                        </div>
                        <div style={{ fontSize: '0.78rem', opacity: 0.7, lineHeight: 1.5 }}>
                            <div>Export: {target ? `${target.w} × ${target.h} px` : 'nativ'}</div>
                            <div>{settings.fps} fps · {formats.find(f => f.key === settings.format)?.label || settings.format}</div>
                        </div>
                        {preset.nativeW && (pxW !== preset.nativeW || pxH !== preset.nativeH) && settings.target !== 'device' && (
                            <div style={{ fontSize: '0.72rem', opacity: 0.55 }}>
                                Gerät nativ: {preset.nativeW} × {preset.nativeH}
                            </div>
                        )}
                        {overflows && (
                            <div style={{ fontSize: '0.75rem', color: '#fbbf24' }}>
                                ⚠ Actor App ragt aus dem sichtbaren Bereich – wird bei der Aufnahme abgeschnitten.
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT: POINTER + RECORDINGS */}
                <div className="rec-scroll" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
                    <Section
                        title="Zeiger-Aufnahme"
                        icon={<MousePointer2 size={14} />}
                        right={
                            <div style={{ display: 'flex', gap: 4 }}>
                                <input ref={importRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={importTakes} />
                                <button style={btn('ghost', { padding: '3px 8px', fontSize: '0.7rem' })} onClick={() => importRef.current?.click()} title="Importieren">Import</button>
                                <button style={btn('ghost', { padding: '3px 8px', fontSize: '0.7rem' })} onClick={exportTakes} disabled={!takes.length} title="Exportieren">Export</button>
                            </div>
                        }
                    >
                        <div style={{ display: 'flex', gap: 6 }}>
                            {!pointerRec ? (
                                <button style={btn('ghost', { flex: 1, borderColor: PINK })} onClick={startPointerRec} disabled={!!playing}>
                                    <Circle size={12} fill={PINK} color={PINK} /> Zeiger aufnehmen
                                </button>
                            ) : (
                                <button style={btn('pink', { flex: 1, animation: 'recPulse 1.4s infinite' })} onClick={stopPointerRec}>
                                    <Square size={12} fill="white" /> Stop
                                </button>
                            )}
                            {playing ? (
                                <button style={btn('ghost')} onClick={stopPlayback}><Square size={12} /> Stop</button>
                            ) : (
                                <button style={btn('ghost')} onClick={() => playTake(activeTake)} disabled={!activeTake || pointerRec}>
                                    <Play size={12} /> Abspielen
                                </button>
                            )}
                        </div>
                        <div style={{ fontSize: '0.7rem', opacity: 0.5, lineHeight: 1.4 }}>
                            Starten, dann in der Actor App klicken/swipen. Die Aufnahme beginnt beim ersten Klick und wird mit „Stop“ oder Esc beendet. Separater Puffer – unabhängig von der Videoaufnahme.
                        </div>

                        {takes.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {takes.map(t => {
                                    const active = t.id === activeTakeId;
                                    return (
                                        <div key={t.id}
                                            onClick={() => setActiveTakeId(t.id)}
                                            style={{
                                                padding: '8px 10px', borderRadius: 10, cursor: 'pointer',
                                                background: active ? 'rgba(236,72,153,0.15)' : 'rgba(255,255,255,0.04)',
                                                border: active ? `1px solid ${PINK}` : '1px solid rgba(255,255,255,0.08)',
                                                display: 'flex', alignItems: 'center', gap: 8, position: 'relative', overflow: 'hidden'
                                            }}>
                                            {playing === t.id && (
                                                <div style={{ position: 'absolute', left: 0, bottom: 0, height: 2, width: `${playPos * 100}%`, background: PINK }} />
                                            )}
                                            <input type="radio" checked={active} readOnly style={{ accentColor: PINK, margin: 0 }} />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</div>
                                                <div style={{ fontSize: '0.7rem', opacity: 0.55 }}>
                                                    {(t.duration / 1000).toFixed(2)} s · {t.events.length} Events{t.width ? ` · ${t.width}×${t.height}` : ''}
                                                </div>
                                            </div>
                                            <button style={btn('ghost', { padding: 5 })} title="Abspielen" disabled={pointerRec}
                                                onClick={(e) => { e.stopPropagation(); setActiveTakeId(t.id); playTake(t); }}><Play size={12} /></button>
                                            <button style={btn('ghost', { padding: 5 })} title="Umbenennen"
                                                onClick={(e) => { e.stopPropagation(); renameTake(t); }}><Edit2 size={12} /></button>
                                            <button style={btn('ghost', { padding: 5 })} title="Löschen"
                                                onClick={(e) => { e.stopPropagation(); deleteTake(t); }}><Trash2 size={12} /></button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {takeSizeMismatch && (
                            <div style={{ fontSize: '0.72rem', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                Zeiger wurde bei {activeTake.width}×{activeTake.height} CSS aufgenommen – Bewegungen werden skaliert.
                                <button style={btn('ghost', { padding: '2px 8px', fontSize: '0.7rem' })} disabled={locked}
                                    onClick={() => setSize({ w: activeTake.width, h: activeTake.height })}>Größe übernehmen</button>
                            </div>
                        )}

                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <Check checked={settings.autoPlayPointer} onChange={v => set({ autoPlayPointer: v })}>
                                Mit REC automatisch abspielen
                            </Check>
                            {settings.autoPlayPointer && (
                                <>
                                    <Field label={`Verzögerung nach Aufnahmestart: ${settings.autoPlayDelay} ms`}>
                                        <input type="range" min="0" max="5000" step="100" value={settings.autoPlayDelay} onChange={e => set({ autoPlayDelay: parseInt(e.target.value, 10) })} style={{ accentColor: PINK }} />
                                    </Field>
                                    <Check checked={settings.autoStop} onChange={v => set({ autoStop: v })}>Aufnahme danach automatisch stoppen</Check>
                                    {settings.autoStop && (
                                        <Field label={`Nachlauf: ${settings.autoStopTail} ms`}>
                                            <input type="range" min="0" max="10000" step="100" value={settings.autoStopTail} onChange={e => set({ autoStopTail: parseInt(e.target.value, 10) })} style={{ accentColor: PINK }} />
                                        </Field>
                                    )}
                                    {!activeTake && <div style={{ fontSize: '0.72rem', color: '#fbbf24' }}>Keine Zeiger-Aufnahme ausgewählt.</div>}
                                </>
                            )}
                            <Check checked={settings.showGhost} onChange={v => set({ showGhost: v })}>
                                Touch-Punkt beim Abspielen anzeigen <span style={{ opacity: 0.5 }}>(wird mit aufgenommen)</span>
                            </Check>
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
                                            {r.targetWidth ? ` · ${r.targetWidth}×${r.targetHeight}` : r.captureWidth ? ` · ${r.captureWidth}×${r.captureHeight}` : ''}
                                            {r.size ? ` · ${fmtBytes(r.size)}` : ''}
                                        </div>
                                    </div>
                                    {r.status === 'done' && r.file && (
                                        <a href={`/uploads/recordings/${encodeURIComponent(r.file)}`} download={r.file} style={{ ...btn('pink', { padding: 6 }), textDecoration: 'none' }} title="Herunterladen">
                                            <Download size={13} />
                                        </a>
                                    )}
                                    {r.rawFile && r.status === 'done' && (
                                        <a href={`/uploads/recordings/${r.rawFile}`} download style={{ ...btn('ghost', { padding: '5px 7px', fontSize: '0.65rem' }), textDecoration: 'none' }} title="Original-Browseraufnahme">RAW</a>
                                    )}
                                    <button style={btn('ghost', { padding: 6 })} title="Löschen" onClick={() => deleteRecording(r)}><Trash2 size={13} /></button>
                                </div>
                                {(r.status === 'queued' || r.status === 'processing') && (
                                    <div>
                                        <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                                            <div style={{ height: '100%', width: `${Math.round((r.progress || 0) * 100)}%`, background: PINK_GRADIENT, transition: 'width 0.4s' }} />
                                        </div>
                                        <div style={{ fontSize: '0.68rem', opacity: 0.6, marginTop: 3 }}>
                                            {r.status === 'queued' ? 'In Warteschlange…' : `Konvertiere… ${Math.round((r.progress || 0) * 100)}%`}
                                        </div>
                                    </div>
                                )}
                                {r.status === 'error' && (
                                    <div style={{ fontSize: '0.7rem', color: '#fca5a5', whiteSpace: 'pre-wrap' }}>Fehler: {r.error}</div>
                                )}
                            </div>
                        ))}
                    </Section>
                </div>
            </div>
        </div>
    );
}
