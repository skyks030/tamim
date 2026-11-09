// Server-side Screen Recorder
// ---------------------------------------------------------------------------
// The phone screen is rendered on the server by a headless Chromium ("virtual phone").
// The browser-based Recorder page only REMOTE-CONTROLS it:
//   - LIVE:   a low-latency JPEG preview stream goes to the client, mouse / wheel / keyboard input comes back
//   - REC:    the server records a timeline (input events + everything the server broadcasts to the apps)
//   - RENDER: the timeline is replayed in a fresh, sandboxed page with a VIRTUAL CLOCK, frame by frame,
//             losslessly (PNG, optional real alpha) and piped straight into ffmpeg (ProRes 422 HQ, 4444 + alpha, …)
// Nothing is recorded in the client browser, so there are no browser/codec/compression artefacts.
//
// Output files + JSON sidecars live in <uploads>/recordings (persisted Docker volume), not in db.json.

const path = require('path');
const fs = require('fs');
const { spawn, execFile } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const virtualTimeScript = require('./virtualTime');

let puppeteer = null;
try { puppeteer = require('puppeteer-core'); } catch { /* reported via state */ }

// ---------------------------------------------------------------------------
// Formats
// ---------------------------------------------------------------------------

const FPS_ORDER = ['23.976', '24', '25', '29.97', '30', '50', '59.94', '60'];
const FPS_MAP = { '23.976': [24000, 1001], '24': [24, 1], '25': [25, 1], '29.97': [30000, 1001], '30': [30, 1], '50': [50, 1], '59.94': [60000, 1001], '60': [60, 1] };

const PRORES = (profile, pixFmt) => ['-c:v', 'prores_ks', '-profile:v', String(profile), '-vendor', 'apl0', '-pix_fmt', pixFmt];
const X264 = ['-c:v', 'libx264', '-preset', 'slow', '-crf', '12', '-pix_fmt', 'yuv420p'];

const FORMATS = {
  prores_hq: { label: 'Apple ProRes 422 HQ (.mov)', ext: 'mov', encoder: 'prores_ks', args: PRORES(3, 'yuv422p10le') },
  prores_422: { label: 'Apple ProRes 422 (.mov)', ext: 'mov', encoder: 'prores_ks', args: PRORES(2, 'yuv422p10le') },
  prores_lt: { label: 'Apple ProRes 422 LT (.mov)', ext: 'mov', encoder: 'prores_ks', args: PRORES(1, 'yuv422p10le') },
  prores_4444: { label: 'Apple ProRes 4444 (.mov)', ext: 'mov', encoder: 'prores_ks', args: PRORES(4, 'yuv444p10le') },
  prores_4444_alpha: { label: 'Apple ProRes 4444 mit Alpha (.mov)', ext: 'mov', encoder: 'prores_ks', alpha: true, args: [...PRORES(4, 'yuva444p10le'), '-alpha_bits', '16'] },
  prores_4444xq_alpha: { label: 'Apple ProRes 4444 XQ mit Alpha (.mov)', ext: 'mov', encoder: 'prores_ks', alpha: true, args: [...PRORES(5, 'yuva444p10le'), '-alpha_bits', '16'] },
  h264_mov: { label: 'H.264 High Quality (.mov)', ext: 'mov', encoder: 'libx264', args: X264 },
  h264_mp4: { label: 'H.264 High Quality (.mp4)', ext: 'mp4', encoder: 'libx264', args: [...X264, '-movflags', '+faststart'] },
  hevc_mp4: { label: 'H.265 / HEVC (.mp4)', ext: 'mp4', encoder: 'libx265', args: ['-c:v', 'libx265', '-preset', 'medium', '-crf', '14', '-pix_fmt', 'yuv420p', '-tag:v', 'hvc1', '-movflags', '+faststart'] },
  png_mov: { label: 'PNG verlustfrei mit Alpha (.mov)', ext: 'mov', encoder: 'png', alpha: true, args: ['-c:v', 'png', '-pix_fmt', 'rgba'] }
};

const CHROME_CANDIDATES = [
  process.env.CHROMIUM_PATH,
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium'
].filter(Boolean);

const LIVE_PREROLL_MS = 1000; // live page settles this long before REC time 0; render pre-rolls the same

// Strip things the phone apps never need (scene backups can be huge)
const appSnapshot = (db) => {
  const { globalScenes, ...rest } = db;
  return JSON.parse(JSON.stringify(rest));
};

module.exports = function setupRecorder(app, io, uploadsDir, getDb) {
  const PORT = process.env.PORT || 3000;
  const APP_URL = `http://127.0.0.1:${PORT}/app`;
  const RECORDINGS_DIR = path.join(uploadsDir, 'recordings');
  fs.mkdirSync(RECORDINGS_DIR, { recursive: true });

  // -------------------------------------------------------------------------
  // Capabilities
  // -------------------------------------------------------------------------
  let encoders = [];
  let ffmpegOk = false;
  execFile('ffmpeg', ['-hide_banner', '-encoders'], { maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
    if (err) { console.warn('[Recorder] ffmpeg not found'); return; }
    ffmpegOk = true;
    encoders = [...new Set(Object.values(FORMATS).map(f => f.encoder))].filter(e => new RegExp(`\\s${e}\\s`).test(stdout));
    console.log('[Recorder] ffmpeg encoders:', encoders.join(', '));
  });
  const chromePath = CHROME_CANDIDATES.find(p => { try { return fs.existsSync(p); } catch { return false; } });
  if (!puppeteer) console.warn('[Recorder] puppeteer-core not installed');
  if (!chromePath) console.warn('[Recorder] no Chromium found (set CHROMIUM_PATH)');

  // -------------------------------------------------------------------------
  // Sidecar metadata (same format as before, so old recordings stay listed)
  // -------------------------------------------------------------------------
  const metaPath = (id) => path.join(RECORDINGS_DIR, `${id}.json`);
  const readMeta = (id) => { try { return JSON.parse(fs.readFileSync(metaPath(id), 'utf8')); } catch { return null; } };
  const writeMeta = (m) => { try { fs.writeFileSync(metaPath(m.id), JSON.stringify(m, null, 2)); } catch (e) { console.error('[Recorder] meta write failed', e); } };
  for (const f of fs.readdirSync(RECORDINGS_DIR)) {
    if (!f.endsWith('.json')) continue;
    const m = readMeta(f.slice(0, -5));
    if (m && (m.status === 'processing' || m.status === 'queued')) {
      m.status = 'error'; m.error = 'Server wurde während des Renderns neu gestartet.'; writeMeta(m);
    }
  }
  const progress = new Map();
  const jobs = new Map();
  const publicMeta = (m) => {
    const { timeline, ...rest } = m; // never send the timeline around
    return { ...rest, progress: progress.get(m.id) ?? (m.status === 'done' ? 1 : 0) };
  };
  const emitJob = (m) => io.emit('recorder:job', publicMeta(m));

  // -------------------------------------------------------------------------
  // Browser
  // -------------------------------------------------------------------------
  let browserPromise = null;
  function getBrowser() {
    if (!puppeteer || !chromePath) return Promise.reject(new Error('Chromium/puppeteer ist auf dem Server nicht verfügbar.'));
    if (!browserPromise) {
      browserPromise = puppeteer.launch({
        executablePath: chromePath,
        headless: true,
        args: [
          '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
          '--disable-gpu', '--hide-scrollbars', '--mute-audio',
          '--disable-smooth-scrolling', '--font-render-hinting=none', '--force-color-profile=srgb',
          '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'
        ]
      }).then(b => {
        b.on('disconnected', () => { browserPromise = null; live.page = null; });
        return b;
      }).catch(e => { browserPromise = null; throw e; });
    }
    return browserPromise;
  }

  // Emulation overrides are per CDP session -> apply them on puppeteer's session AND on ours (screenshots/screencast)
  async function applyViewport(page, cdp, viewport) {
    const dpr = viewport.dpr || 1;
    await page.setViewport({ width: viewport.w, height: viewport.h, deviceScaleFactor: dpr });
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: viewport.w, height: viewport.h, deviceScaleFactor: dpr, mobile: false });
  }

  async function preparePage(page, viewport, { transparent } = {}) {
    const cdp = await page.createCDPSession();
    await applyViewport(page, cdp, viewport);
    if (transparent) await cdp.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
    return cdp;
  }

  // -------------------------------------------------------------------------
  // LIVE session (one shared virtual phone)
  // -------------------------------------------------------------------------
  const live = {
    page: null,
    cdp: null,
    viewport: { w: 402, h: 874, dpr: 1 },
    starting: null,
    screencasting: false,
    viewers: new Set(),
    error: null,
    rec: null, // { t0, snapshot, timeline: [], viewport }
    playTimers: []
  };

  const liveState = () => ({
    ready: !!live.page,
    error: live.error,
    viewport: live.viewport,
    recording: live.rec ? { since: live.rec.t0 } : null,
    playing: live.playTimers.length > 0,
    chromium: !!(puppeteer && chromePath),
    ffmpeg: ffmpegOk
  });
  const emitState = () => io.to('recorder').emit('rec:state', liveState());

  async function ensureLive() {
    if (live.page && !live.page.isClosed()) return live.page;
    if (live.starting) return live.starting;
    live.starting = (async () => {
      try {
        const browser = await getBrowser();
        const page = await browser.newPage();
        const cdp = await preparePage(page, { ...live.viewport, dpr: 1 });
        await page.evaluateOnNewDocument(() => {
          document.addEventListener('DOMContentLoaded', () => {
            const st = document.createElement('style');
            st.textContent = '::-webkit-scrollbar{display:none!important}';
            document.head.appendChild(st);
          });
        });
        cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
          cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => { });
          io.to('recorder').volatile.emit('rec:frame', { jpeg: Buffer.from(data, 'base64'), w: metadata.deviceWidth, h: metadata.deviceHeight });
        });
        page.on('close', () => { if (live.page === page) { live.page = null; live.screencasting = false; } });
        await page.goto(APP_URL, { waitUntil: 'load', timeout: 30000 });
        live.page = page;
        live.cdp = cdp;
        live.error = null;
        live.screencasting = false;
        await syncScreencast();
        return page;
      } catch (e) {
        live.error = e.message;
        console.error('[Recorder] live page failed:', e);
        throw e;
      } finally {
        live.starting = null;
        emitState();
      }
    })();
    return live.starting;
  }

  async function syncScreencast() {
    if (!live.cdp || !live.page) return;
    const want = live.viewers.size > 0;
    try {
      if (want && !live.screencasting) {
        await live.cdp.send('Page.startScreencast', { format: 'jpeg', quality: 75, maxWidth: 900, maxHeight: 1800, everyNthFrame: 1 });
        live.screencasting = true;
      } else if (!want && live.screencasting) {
        await live.cdp.send('Page.stopScreencast');
        live.screencasting = false;
      }
    } catch (e) { console.error('[Recorder] screencast', e.message); }
  }

  async function restartScreencast() {
    if (!live.cdp) return;
    try { await live.cdp.send('Page.stopScreencast'); } catch { }
    live.screencasting = false;
    await syncScreencast();
  }

  // --- input dispatch (same function for live and render, all events are TRUSTED browser input) ---
  const KEY_DEFS = {
    Enter: { code: 'Enter', keyCode: 13, text: '\r' }, Backspace: { code: 'Backspace', keyCode: 8 }, Tab: { code: 'Tab', keyCode: 9 },
    Escape: { code: 'Escape', keyCode: 27 }, Delete: { code: 'Delete', keyCode: 46 },
    ArrowLeft: { code: 'ArrowLeft', keyCode: 37 }, ArrowUp: { code: 'ArrowUp', keyCode: 38 },
    ArrowRight: { code: 'ArrowRight', keyCode: 39 }, ArrowDown: { code: 'ArrowDown', keyCode: 40 }
  };

  async function dispatchInput(cdp, viewport, ev) {
    const x = Math.round((ev.x ?? 0) * viewport.w * 100) / 100;
    const y = Math.round((ev.y ?? 0) * viewport.h * 100) / 100;
    if (ev.kind === 'mouse') {
      const type = { down: 'mousePressed', up: 'mouseReleased', move: 'mouseMoved' }[ev.type];
      if (!type) return;
      await cdp.send('Input.dispatchMouseEvent', {
        type, x, y,
        button: ev.type === 'move' ? (ev.buttons & 1 ? 'left' : 'none') : 'left',
        buttons: ev.buttons ?? (ev.type === 'down' ? 1 : 0),
        clickCount: ev.type === 'move' ? 0 : 1
      });
    } else if (ev.kind === 'wheel') {
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: ev.dx || 0, deltaY: ev.dy || 0 });
    } else if (ev.kind === 'key') {
      const def = KEY_DEFS[ev.key];
      if (def) {
        const base = { key: ev.key, code: def.code, windowsVirtualKeyCode: def.keyCode, nativeVirtualKeyCode: def.keyCode };
        await cdp.send('Input.dispatchKeyEvent', { type: def.text ? 'keyDown' : 'rawKeyDown', ...base, text: def.text });
        await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
      } else if (typeof ev.text === 'string' && ev.text.length) {
        await cdp.send('Input.insertText', { text: ev.text });
      }
    }
  }

  // Record everything the server broadcasts to the apps while REC is running
  const origEmit = io.emit.bind(io);
  io.emit = (event, ...args) => {
    if (live.rec && typeof event === 'string' && !event.startsWith('recorder:') && !event.startsWith('rec:')) {
      try {
        const payload = event === 'data:update' ? appSnapshot(args[0]) : JSON.parse(JSON.stringify(args[0] ?? null));
        live.rec.timeline.push({ t: Date.now() - live.rec.t0, kind: 'server', event, payload });
      } catch (e) { console.error('[Recorder] could not record server event', event, e.message); }
    }
    return origEmit(event, ...args);
  };

  function stopLivePlayback() {
    live.playTimers.forEach(clearTimeout);
    live.playTimers = [];
  }

  // -------------------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------------------
  let queue = Promise.resolve();

  function enqueueRender(meta) {
    jobs.set(meta.id, meta);
    writeMeta(meta);
    emitJob(meta);
    queue = queue
      .then(() => (meta.cancelled ? null : renderJob(meta)))
      .catch(e => {
        console.error('[Recorder] render failed', e);
        if (!meta.cancelled) {
          meta.status = 'error';
          meta.error = e.message;
          writeMeta(meta);
          emitJob(meta);
        }
      })
      .finally(() => {
        jobs.delete(meta.id);
        // the timeline is only needed for rendering
        const m = readMeta(meta.id);
        if (m && m.timeline) { delete m.timeline; writeMeta(m); }
      });
  }

  async function renderJob(meta) {
    const fmt = FORMATS[meta.format];
    const [num, den] = FPS_MAP[meta.fps] || FPS_MAP['30'];
    const frameMs = (1000 * den) / num;
    const totalFrames = Math.max(1, Math.round(meta.durationMs / frameMs));
    const vp = meta.viewport;
    const transparent = !!meta.transparent;

    meta.status = 'processing';
    progress.set(meta.id, 0);
    writeMeta(meta);
    emitJob(meta);

    const browser = await getBrowser();
    const context = await browser.createBrowserContext();
    let ff = null;
    const outFile = `${meta.baseName}.${fmt.ext}`;
    const outPath = path.join(RECORDINGS_DIR, outFile);

    try {
      const page = await context.newPage();
      const cdp = await preparePage(page, vp, { transparent });
      await page.evaluateOnNewDocument(virtualTimeScript);
      await page.evaluateOnNewDocument((data, reducer) => {
        window.__TAMIM_SANDBOX__ = data;
        window.__TAMIM_SANDBOX_REDUCER__ = reducer;
      }, meta.timeline.snapshot, meta.mode === 'take');

      await page.goto(`${APP_URL}?sandbox=1`, { waitUntil: 'load', timeout: 60000 });

      // Preload every uploaded image the app could show, plus fonts
      await page.evaluate(async () => {
        const urls = [...new Set((JSON.stringify(window.__TAMIM_SANDBOX__).match(/\/uploads\/[^"'\s)]+/g) || []))].slice(0, 300);
        await Promise.all(urls.map(u => new Promise(res => {
          const img = new Image();
          img.onload = img.onerror = () => (img.decode ? img.decode().catch(() => { }).then(res) : res());
          img.src = u;
        })));
        if (document.fonts?.ready) await document.fonts.ready;
      });

      // Pre-roll (same settling time the live page had before REC started)
      await page.evaluate(ms => window.__vt.advance(ms), LIVE_PREROLL_MS);

      // ffmpeg reads lossless PNG frames from stdin
      const r = `${num}/${den}`;
      const chain = [
        'crop=trunc(iw/2)*2:trunc(ih/2)*2:0:0', // 4:2:2 needs even sizes – crop 1px instead of resampling
        meta.targetWidth && meta.targetHeight ? `scale=${meta.targetWidth}:${meta.targetHeight}:flags=lanczos` : null,
        fmt.encoder === 'png' ? null : `scale=out_color_matrix=bt709:out_range=tv,format=${fmt.args[fmt.args.indexOf('-pix_fmt') + 1]}`,
        'setsar=1'
      ].filter(Boolean).join(',');
      const args = [
        '-hide_banner', '-y',
        '-f', 'image2pipe', '-framerate', r, '-c:v', 'png', '-i', 'pipe:0',
        '-vf', chain,
        '-r', r,
        ...fmt.args,
        ...(fmt.encoder === 'png' ? [] : ['-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709']),
        outPath
      ];
      ff = spawn('ffmpeg', args, { stdio: ['pipe', 'ignore', 'pipe'] });
      let stderrTail = '';
      ff.stderr.on('data', c => { stderrTail = (stderrTail + c).slice(-3000); });
      const ffDone = new Promise((resolve, reject) => {
        ff.on('error', reject);
        ff.on('close', code => code === 0 ? resolve() : reject(new Error(stderrTail.split('\n').filter(Boolean).slice(-3).join('\n') || `ffmpeg exit ${code}`)));
      });
      let pipeError = null;
      ff.stdin.on('error', e => { pipeError = e; });
      const write = (buf) => new Promise((resolve, reject) => {
        if (pipeError) return reject(pipeError);
        if (!ff.stdin.write(buf)) ff.stdin.once('drain', resolve); else resolve();
      });

      const items = [...meta.timeline.events].sort((a, b) => a.t - b.t);
      let k = 0;
      let vt = 0; // virtual ms since REC time 0
      let lastEmit = 0;

      for (let i = 0; i < totalFrames; i++) {
        if (meta.cancelled) throw new Error('cancelled');
        const tFrame = i * frameMs;
        while (k < items.length && items[k].t <= tFrame) {
          const it = items[k++];
          if (it.t > vt) { await page.evaluate(ms => window.__vt.advance(ms), it.t - vt); vt = it.t; }
          if (it.kind === 'server') {
            await page.evaluate((ev, p) => window.__tamimServerEvent?.(ev, p), it.event, it.payload);
          } else {
            await dispatchInput(cdp, vp, it);
          }
          await page.evaluate(() => window.__vt.settle());
        }
        if (tFrame > vt) { await page.evaluate(ms => window.__vt.advance(ms), tFrame - vt); vt = tFrame; }
        else await page.evaluate(() => window.__vt.settle());

        const shot = await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true, captureBeyondViewport: false });
        await write(Buffer.from(shot.data, 'base64'));

        progress.set(meta.id, (i + 1) / totalFrames);
        if (Date.now() - lastEmit > 400) { lastEmit = Date.now(); emitJob(meta); }
      }

      ff.stdin.end();
      await ffDone;

      meta.status = 'done';
      meta.file = outFile;
      try { meta.size = fs.statSync(outPath).size; } catch { }
      meta.width = (meta.targetWidth || Math.floor(vp.w * vp.dpr / 2) * 2);
      meta.height = (meta.targetHeight || Math.floor(vp.h * vp.dpr / 2) * 2);
      progress.set(meta.id, 1);
      writeMeta(meta);
      emitJob(meta);
    } catch (e) {
      if (ff && ff.exitCode === null) { try { ff.stdin.destroy(); ff.kill('SIGKILL'); } catch { } }
      fs.rm(outPath, { force: true }, () => { });
      if (meta.cancelled) return;
      throw e;
    } finally {
      await context.close().catch(() => { });
    }
  }

  function createJob({ name, mode, timeline, durationMs, settings }) {
    const format = FORMATS[settings.format] ? settings.format : 'prores_hq';
    const fmt = FORMATS[format];
    if (!encoders.includes(fmt.encoder)) throw new Error(`Encoder ${fmt.encoder} ist auf dem Server nicht verfügbar.`);
    const vp = settings.viewport || live.viewport;
    const dpr = Math.min(6, Math.max(0.5, Number(settings.dpr) || 3));
    const id = uuidv4();
    const safeName = String(name || 'Take').replace(/[^\w\-]+/g, '_').slice(0, 60) || 'Take';
    const even = (n) => { const v = parseInt(n, 10); return v > 0 ? Math.max(2, Math.round(v / 2) * 2) : null; };
    return {
      id,
      name: name || 'Take',
      baseName: `${safeName}_${id.slice(0, 6)}`,
      createdAt: Date.now(),
      status: 'queued',
      mode,
      format,
      formatLabel: fmt.label,
      fps: FPS_MAP[settings.fps] ? String(settings.fps) : '30',
      durationMs: Math.max(100, Math.round(durationMs)),
      viewport: { w: Math.round(vp.w), h: Math.round(vp.h), dpr },
      transparent: !!settings.transparent && !!fmt.alpha,
      targetWidth: even(settings.targetWidth),
      targetHeight: even(settings.targetHeight),
      file: null,
      size: null,
      error: null,
      timeline
    };
  }

  // -------------------------------------------------------------------------
  // REST
  // -------------------------------------------------------------------------
  app.get('/api/recordings/capabilities', (req, res) => {
    res.json({
      ffmpeg: ffmpegOk,
      chromium: !!(puppeteer && chromePath),
      formats: Object.entries(FORMATS).filter(([, f]) => encoders.includes(f.encoder)).map(([key, f]) => ({ key, label: f.label, alpha: !!f.alpha })),
      fps: FPS_ORDER
    });
  });

  app.get('/api/recordings', (req, res) => {
    const list = fs.readdirSync(RECORDINGS_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => jobs.get(f.slice(0, -5)) || readMeta(f.slice(0, -5)))
      .filter(Boolean)
      .map(publicMeta)
      .sort((a, b) => b.createdAt - a.createdAt);
    res.json(list);
  });

  app.delete('/api/recordings/:id', (req, res) => {
    const { id } = req.params;
    if (!/^[0-9a-f-]{36}$/.test(id)) return res.status(400).json({ error: 'Invalid id' });
    const meta = jobs.get(id) || readMeta(id);
    if (!meta) return res.status(404).json({ error: 'Not found' });
    meta.cancelled = true;
    for (const rel of [meta.file, meta.rawFile]) if (rel) fs.rm(path.join(RECORDINGS_DIR, rel), { force: true }, () => { });
    fs.rm(metaPath(id), { force: true }, () => { });
    progress.delete(id);
    io.emit('recorder:job_deleted', { id });
    res.json({ success: true });
  });

  // -------------------------------------------------------------------------
  // Socket control
  // -------------------------------------------------------------------------
  io.on('connection', (socket) => {
    const ack = (cb, payload) => { if (typeof cb === 'function') cb(payload); };

    socket.on('rec:join', async (opts, cb) => {
      socket.join('recorder');
      live.viewers.add(socket.id);
      if (opts?.viewport && !live.page && !live.starting) live.viewport = { w: opts.viewport.w, h: opts.viewport.h, dpr: 1 };
      try { await ensureLive(); await syncScreencast(); } catch { /* reported in state */ }
      ack(cb, liveState());
      socket.emit('rec:state', liveState());
    });

    const leave = () => {
      socket.leave('recorder');
      if (live.viewers.delete(socket.id)) syncScreencast();
    };
    socket.on('rec:leave', leave);
    socket.on('disconnect', leave);

    socket.on('rec:viewport', async ({ w, h }) => {
      if (live.rec) return;
      w = Math.max(200, Math.min(1600, Math.round(w)));
      h = Math.max(300, Math.min(3200, Math.round(h)));
      live.viewport = { w, h, dpr: 1 };
      try {
        const page = await ensureLive();
        await applyViewport(page, live.cdp, live.viewport);
        await restartScreencast();
      } catch { }
      emitState();
    });

    socket.on('rec:reload', async () => {
      try {
        const page = await ensureLive();
        await page.goto(APP_URL, { waitUntil: 'load', timeout: 30000 });
      } catch (e) { live.error = e.message; }
      emitState();
    });

    socket.on('rec:input', async (ev) => {
      if (!live.page || !live.cdp || !ev) return;
      if (live.rec) live.rec.timeline.push({ ...ev, t: Date.now() - live.rec.t0 });
      try { await dispatchInput(live.cdp, live.viewport, ev); } catch { /* page navigating */ }
    });

    // REC: reload to a clean state, snapshot the data, then log every input + server broadcast
    socket.on('rec:start', async (opts, cb) => {
      if (live.rec) return ack(cb, { error: 'Aufnahme läuft bereits.' });
      try {
        stopLivePlayback();
        const page = await ensureLive();
        await page.goto(APP_URL, { waitUntil: 'load', timeout: 30000 });
        await page.evaluate(() => document.fonts?.ready);
        await new Promise(r => setTimeout(r, LIVE_PREROLL_MS));
        live.rec = { t0: Date.now(), snapshot: appSnapshot(getDb()), timeline: [], viewport: { ...live.viewport } };
        emitState();
        ack(cb, { ok: true });
      } catch (e) {
        ack(cb, { error: e.message });
      }
    });

    socket.on('rec:stop', (opts, cb) => {
      const rec = live.rec;
      if (!rec) return ack(cb, { error: 'Keine Aufnahme aktiv.' });
      live.rec = null;
      emitState();
      if (opts?.discard) return ack(cb, { ok: true, discarded: true });
      try {
        const meta = createJob({
          name: opts?.name,
          mode: 'live',
          durationMs: Date.now() - rec.t0,
          timeline: { snapshot: rec.snapshot, events: rec.timeline },
          settings: { ...(opts?.settings || {}), viewport: rec.viewport }
        });
        enqueueRender(meta);
        ack(cb, { ok: true, id: meta.id });
      } catch (e) {
        ack(cb, { error: e.message });
      }
    });

    // Render a pointer take against the CURRENT data (e.g. same swipe, different profile)
    socket.on('rec:render_take', ({ take, name, settings } = {}, cb) => {
      try {
        if (!take?.events?.length) throw new Error('Leere Zeiger-Aufnahme.');
        const lead = Math.max(0, Number(settings?.leadIn) || 0);
        const tail = Math.max(0, Number(settings?.tail) || 0);
        const events = take.events.map(e => ({ ...e, t: e.t + lead }));
        const meta = createJob({
          name,
          mode: 'take',
          durationMs: lead + (take.duration || events[events.length - 1].t) + tail,
          timeline: { snapshot: appSnapshot(getDb()), events },
          settings: { ...(settings || {}), viewport: take.viewport || live.viewport }
        });
        enqueueRender(meta);
        ack(cb, { ok: true, id: meta.id });
      } catch (e) {
        ack(cb, { error: e.message });
      }
    });

    // Play a take on the live phone (preview only)
    socket.on('rec:play_take', ({ take } = {}) => {
      stopLivePlayback();
      if (!take?.events?.length || !live.cdp) return;
      for (const ev of take.events) {
        live.playTimers.push(setTimeout(() => {
          if (live.rec) live.rec.timeline.push({ ...ev, t: Date.now() - live.rec.t0 });
          dispatchInput(live.cdp, live.viewport, ev).catch(() => { });
        }, ev.t));
      }
      live.playTimers.push(setTimeout(() => { live.playTimers = []; emitState(); }, (take.duration || 0) + 50));
      emitState();
    });
    socket.on('rec:stop_play', () => { stopLivePlayback(); emitState(); });
  });
};
