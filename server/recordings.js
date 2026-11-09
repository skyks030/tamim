// Screen Recorder backend:
// - receives the raw browser recording (WebM/MP4 from MediaRecorder)
// - transcodes it with ffmpeg into the requested delivery format (e.g. ProRes 422 HQ in .mov)
// - keeps a small JSON sidecar per recording (NOT in db.json, so scene data stays untouched)
//
// Files live in <uploads>/recordings, which is inside the persisted /app/uploads Docker volume.

const path = require('path');
const fs = require('fs');
const { spawn, execFile } = require('child_process');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const FPS_MAP = {
  '23.976': '24000/1001',
  '24': '24',
  '25': '25',
  '29.97': '30000/1001',
  '30': '30',
  '50': '50',
  '59.94': '60000/1001',
  '60': '60'
};

// Object key order puts integer keys first, so keep an explicit display order
const FPS_ORDER = ['23.976', '24', '25', '29.97', '30', '50', '59.94', '60'];

const PRORES = (profile, pixFmt) => ['-c:v', 'prores_ks', '-profile:v', String(profile), '-vendor', 'apl0', '-pix_fmt', pixFmt];
const X264 = ['-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p'];

const FORMATS = {
  prores_hq: { label: 'Apple ProRes 422 HQ (.mov)', ext: 'mov', encoder: 'prores_ks', args: PRORES(3, 'yuv422p10le') },
  prores_422: { label: 'Apple ProRes 422 (.mov)', ext: 'mov', encoder: 'prores_ks', args: PRORES(2, 'yuv422p10le') },
  prores_lt: { label: 'Apple ProRes 422 LT (.mov)', ext: 'mov', encoder: 'prores_ks', args: PRORES(1, 'yuv422p10le') },
  prores_proxy: { label: 'Apple ProRes 422 Proxy (.mov)', ext: 'mov', encoder: 'prores_ks', args: PRORES(0, 'yuv422p10le') },
  prores_4444: { label: 'Apple ProRes 4444 (.mov)', ext: 'mov', encoder: 'prores_ks', args: PRORES(4, 'yuv444p10le') },
  // Alpha formats – used with the transparent (difference matte) mode
  prores_4444_alpha: { label: 'Apple ProRes 4444 mit Alpha (.mov)', ext: 'mov', encoder: 'prores_ks', alpha: true, args: [...PRORES(4, 'yuva444p10le'), '-alpha_bits', '16'] },
  prores_4444xq_alpha: { label: 'Apple ProRes 4444 XQ mit Alpha (.mov)', ext: 'mov', encoder: 'prores_ks', alpha: true, args: [...PRORES(5, 'yuva444p10le'), '-alpha_bits', '16'] },
  h264_mov: { label: 'H.264 High Quality (.mov)', ext: 'mov', encoder: 'libx264', args: X264 },
  h264_mp4: { label: 'H.264 High Quality (.mp4)', ext: 'mp4', encoder: 'libx264', args: [...X264, '-movflags', '+faststart'] },
  hevc_mp4: { label: 'H.265 / HEVC (.mp4)', ext: 'mp4', encoder: 'libx265', args: ['-c:v', 'libx265', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-tag:v', 'hvc1', '-movflags', '+faststart'] },
  raw: { label: 'Original Browser-Aufnahme (kein Transcode)', ext: null, encoder: null, args: null }
};

module.exports = function setupRecordings(app, io, uploadsDir) {
  const RECORDINGS_DIR = path.join(uploadsDir, 'recordings');
  const RAW_DIR = path.join(RECORDINGS_DIR, 'raw');
  fs.mkdirSync(RAW_DIR, { recursive: true });

  // --- ffmpeg capability detection ---
  let caps = { ffmpeg: false, encoders: [] };
  execFile('ffmpeg', ['-hide_banner', '-encoders'], { maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
    if (err) {
      console.warn('[Recorder] ffmpeg not found – transcoding disabled. Install ffmpeg to enable ProRes export.');
      return;
    }
    const encoders = Object.values(FORMATS).map(f => f.encoder).filter(Boolean)
      .filter(e => new RegExp(`\\s${e}\\s`).test(stdout));
    caps = { ffmpeg: true, encoders: [...new Set(encoders)] };
    console.log('[Recorder] ffmpeg available. Encoders:', caps.encoders.join(', '));
  });

  // --- sidecar helpers ---
  const metaPath = (id) => path.join(RECORDINGS_DIR, `${id}.json`);
  const readMeta = (id) => {
    try { return JSON.parse(fs.readFileSync(metaPath(id), 'utf8')); } catch { return null; }
  };
  const writeMeta = (meta) => {
    try { fs.writeFileSync(metaPath(meta.id), JSON.stringify(meta, null, 2)); } catch (e) { console.error('[Recorder] meta write failed', e); }
  };
  const isSafeId = (id) => /^[0-9a-f-]{36}$/.test(id);

  // Recordings that were mid-transcode when the server stopped can't be resumed.
  for (const f of fs.readdirSync(RECORDINGS_DIR)) {
    if (!f.endsWith('.json')) continue;
    const m = readMeta(f.replace(/\.json$/, ''));
    if (m && (m.status === 'processing' || m.status === 'queued')) {
      m.status = 'error';
      m.error = 'Server wurde während der Konvertierung neu gestartet.';
      writeMeta(m);
    }
  }

  const progress = new Map(); // id -> 0..1
  const running = new Map();  // id -> child process
  const jobs = new Map();     // id -> live meta object of queued/processing jobs
  const emit = (meta) => io.emit('recorder:job', { ...meta, progress: progress.get(meta.id) ?? (meta.status === 'done' ? 1 : 0) });

  // Serial queue so multiple ProRes encodes don't fight for the CPU
  let queue = Promise.resolve();

  const transcode = (meta, rawPath) => new Promise((resolve) => {
    const fmt = FORMATS[meta.format];
    const outFile = `${meta.baseName}.${fmt.ext}`;
    const outPath = path.join(RECORDINGS_DIR, outFile);

    const fps = FPS_MAP[meta.fps] || '30';
    const pixFmt = fmt.args[fmt.args.indexOf('-pix_fmt') + 1];
    // 4:2:2 / 4:2:0 need even dimensions
    const scale = meta.targetWidth && meta.targetHeight
      ? `scale=${meta.targetWidth}:${meta.targetHeight}:flags=lanczos:out_color_matrix=bt709,format=${pixFmt},setsar=1`
      : `scale=trunc(iw/2)*2:trunc(ih/2)*2:flags=lanczos:out_color_matrix=bt709,format=${pixFmt},setsar=1`;

    let filterArgs;
    if (meta.alphaMatte) {
      // Difference matte: left half = app over black, right half = identical app over white.
      //   alpha = 1 - (white - black), colour = black / alpha (un-premultiply)
      const U = 'if(y,min(255,x*255/y),0)';
      const graph = [
        `[0:v]fps=${fps},format=gbrp,split=3[a][b][c]`,
        `[a]crop=trunc(iw/2):ih:0:0[blk1]`,
        `[c]crop=trunc(iw/2):ih:0:0[blk2]`,
        `[b]crop=trunc(iw/2):ih:trunc(iw/2):0[wht]`,
        // small thresholds swallow compression noise of the intermediate recording
        `[wht][blk1]blend=all_mode=difference,format=gray,negate,lut=c0='if(gte(val,250),255,if(lte(val,5),0,val))',split=2[al1][al2]`,
        `[al1]format=gbrp[alrgb]`,
        `[blk2][alrgb]lut2=c0='${U}':c1='${U}':c2='${U}'[col]`,
        `[col][al2]alphamerge,${scale}[out]`
      ].join(';');
      filterArgs = ['-filter_complex', graph, '-map', '[out]'];
    } else {
      filterArgs = ['-vf', `fps=${fps},${scale}`];
    }

    const args = [
      '-hide_banner', '-y',
      '-i', rawPath,
      '-an',
      ...filterArgs,
      '-r', fps,
      ...fmt.args,
      '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
      '-progress', 'pipe:1', '-nostats',
      outPath
    ];

    meta.status = 'processing';
    writeMeta(meta);
    progress.set(meta.id, 0);
    emit(meta);

    const proc = spawn('ffmpeg', args);
    running.set(meta.id, proc);
    let stderrTail = '';
    let lastEmit = 0;

    proc.stdout.on('data', (chunk) => {
      const m = /out_time_us=(\d+)/.exec(chunk.toString()) || /out_time_ms=(\d+)/.exec(chunk.toString());
      if (m && meta.durationMs > 0) {
        const p = Math.min(0.99, (parseInt(m[1], 10) / 1000) / meta.durationMs);
        progress.set(meta.id, p);
        if (Date.now() - lastEmit > 500) { lastEmit = Date.now(); emit(meta); }
      }
    });
    proc.stderr.on('data', (chunk) => { stderrTail = (stderrTail + chunk.toString()).slice(-2000); });

    proc.on('close', (code) => {
      running.delete(meta.id);
      if (meta.cancelled) return resolve();
      if (code === 0) {
        meta.status = 'done';
        meta.file = outFile;
        try { meta.size = fs.statSync(outPath).size; } catch { }
        progress.set(meta.id, 1);
        if (!meta.keepRaw) {
          fs.rm(rawPath, { force: true }, () => { });
          meta.rawFile = null;
        }
      } else {
        meta.status = 'error';
        meta.error = stderrTail.split('\n').filter(Boolean).slice(-4).join('\n') || `ffmpeg exit code ${code}`;
        console.error('[Recorder] ffmpeg failed:', stderrTail);
      }
      writeMeta(meta);
      emit(meta);
      resolve();
    });
  });

  // --- Upload ---
  const upload = multer({
    storage: multer.diskStorage({
      destination: RAW_DIR,
      filename: (req, file, cb) => {
        const ext = (file.originalname.match(/\.(webm|mp4|mkv|mov)$/i) || [, 'webm'])[1].toLowerCase();
        cb(null, `${uuidv4()}.${ext}`);
      }
    }),
    limits: { fileSize: 50 * 1024 * 1024 * 1024 }
  });

  app.get('/api/recordings/capabilities', (req, res) => {
    const formats = Object.entries(FORMATS)
      .filter(([, f]) => !f.encoder || caps.encoders.includes(f.encoder))
      .map(([key, f]) => ({ key, label: f.label, alpha: !!f.alpha }));
    res.json({ ffmpeg: caps.ffmpeg, formats, fps: FPS_ORDER });
  });

  app.get('/api/recordings', (req, res) => {
    const list = fs.readdirSync(RECORDINGS_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => readMeta(f.replace(/\.json$/, '')))
      .filter(Boolean)
      .map(m => ({ ...m, progress: progress.get(m.id) ?? (m.status === 'done' ? 1 : 0) }))
      .sort((a, b) => b.createdAt - a.createdAt);
    res.json(list);
  });

  app.post('/api/recordings', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    let settings = {};
    try { settings = JSON.parse(req.body.settings || '{}'); } catch { }

    const format = FORMATS[settings.format] ? settings.format : 'prores_hq';
    const fmt = FORMATS[format];
    const alphaMatte = !!settings.alphaMatte;
    if (alphaMatte && !fmt.alpha && format !== 'raw') {
      fs.rm(req.file.path, { force: true }, () => { });
      return res.status(400).json({ error: 'Für transparente Aufnahmen bitte ein Format mit Alpha wählen (ProRes 4444 mit Alpha).' });
    }
    if (fmt.encoder && !caps.encoders.includes(fmt.encoder)) {
      fs.rm(req.file.path, { force: true }, () => { });
      return res.status(400).json({ error: `Encoder ${fmt.encoder} ist auf dem Server nicht verfügbar (ffmpeg installiert?).` });
    }

    const even = (n) => { const v = parseInt(n, 10); return v > 0 ? Math.max(2, Math.round(v / 2) * 2) : null; };
    const id = uuidv4();
    const safeName = String(settings.name || 'Recording').replace(/[^\w\-]+/g, '_').slice(0, 60) || 'Recording';
    const rawExt = path.extname(req.file.filename);

    const meta = {
      id,
      name: settings.name || 'Recording',
      baseName: `${safeName}_${id.slice(0, 6)}`,
      createdAt: Date.now(),
      status: 'queued',
      format,
      formatLabel: fmt.label,
      fps: FPS_MAP[settings.fps] ? String(settings.fps) : '30',
      durationMs: Number(settings.durationMs) || 0,
      captureWidth: Number(settings.captureWidth) || null,
      captureHeight: Number(settings.captureHeight) || null,
      targetWidth: even(settings.targetWidth),
      targetHeight: even(settings.targetHeight),
      keepRaw: !!settings.keepRaw || format === 'raw',
      alphaMatte,
      rawFile: `raw/${req.file.filename}`,
      file: null,
      size: null,
      error: null
    };

    if (format === 'raw') {
      const outFile = `${meta.baseName}${rawExt}`;
      fs.renameSync(req.file.path, path.join(RECORDINGS_DIR, outFile));
      meta.rawFile = null;
      meta.file = outFile;
      meta.size = req.file.size;
      meta.status = 'done';
      writeMeta(meta);
      emit(meta);
      return res.json(meta);
    }

    writeMeta(meta);
    emit(meta);
    jobs.set(id, meta);
    queue = queue
      .then(() => (meta.cancelled ? null : transcode(meta, req.file.path)))
      .catch(e => console.error('[Recorder] job failed', e))
      .finally(() => jobs.delete(id));
    res.json(meta);
  });

  app.delete('/api/recordings/:id', (req, res) => {
    const { id } = req.params;
    if (!isSafeId(id)) return res.status(400).json({ error: 'Invalid id' });
    const meta = jobs.get(id) || readMeta(id);
    if (!meta) return res.status(404).json({ error: 'Not found' });

    meta.cancelled = true;
    const proc = running.get(id);
    if (proc) proc.kill('SIGKILL');

    for (const rel of [meta.file, meta.rawFile, meta.file ? null : `${meta.baseName}.${FORMATS[meta.format]?.ext}`]) {
      if (rel) fs.rm(path.join(RECORDINGS_DIR, rel), { force: true }, () => { });
    }
    fs.rm(metaPath(id), { force: true }, () => { });
    progress.delete(id);
    io.emit('recorder:job_deleted', { id });
    res.json({ success: true });
  });
};
