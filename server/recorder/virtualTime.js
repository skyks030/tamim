// Injected into the render page BEFORE any app code runs.
// Replaces the page clock (Date, performance.now, timers, requestAnimationFrame) with a virtual clock and
// seeks all CSS animations/transitions (Web Animations API) to that clock, so every video frame is rendered
// at an exact point in time – independent of how long rendering/screenshotting takes on the server.
//
// Driven from Node via:  await page.evaluate(ms => window.__vt.advance(ms), frameMs)

module.exports = function virtualTimeScript() {
  if (window.__vt) return;

  const realSetTimeout = window.setTimeout.bind(window);
  const realPerfNow = performance.now.bind(performance);
  const RealDate = Date;
  const epoch = RealDate.now();

  let now = 0; // virtual ms since page start
  let seq = 0;
  const timers = new Map(); // id -> {at, fn, args, interval}
  let rafQueue = [];
  let rafSeq = 0;

  // --- Clock ---
  performance.now = () => now;

  function VDate(...args) {
    if (!(this instanceof VDate)) return new RealDate(epoch + now).toString();
    return args.length ? new RealDate(...args) : new RealDate(epoch + now);
  }
  VDate.prototype = RealDate.prototype;
  VDate.now = () => epoch + now;
  VDate.parse = RealDate.parse;
  VDate.UTC = RealDate.UTC;
  window.Date = VDate;

  // --- Timers ---
  window.setTimeout = (fn, delay = 0, ...args) => {
    const id = ++seq;
    timers.set(id, { at: now + Math.max(0, Number(delay) || 0), fn, args, interval: null });
    return id;
  };
  window.setInterval = (fn, delay = 0, ...args) => {
    const id = ++seq;
    const d = Math.max(1, Number(delay) || 0);
    timers.set(id, { at: now + d, fn, args, interval: d });
    return id;
  };
  window.clearTimeout = window.clearInterval = (id) => { timers.delete(id); };

  window.requestAnimationFrame = (fn) => { const id = ++rafSeq; rafQueue.push({ id, fn }); return id; };
  window.cancelAnimationFrame = (id) => { rafQueue = rafQueue.filter(r => r.id !== id); };

  const run = (fn, args) => {
    try { typeof fn === 'function' ? fn(...(args || [])) : (0, eval)(String(fn)); } catch (e) { console.error(e); }
  };

  // --- CSS animations / transitions ---
  const tracked = new WeakMap(); // Animation -> virtual start time
  function seekAnimations() {
    let anims = [];
    try { anims = document.getAnimations(); } catch { return; }
    for (const a of anims) {
      if (!tracked.has(a)) {
        // newly created since the last frame -> it starts "now" on the virtual clock
        tracked.set(a, now);
        try { a.pause(); } catch { /* ignore */ }
      }
      const start = tracked.get(a);
      const rate = a.playbackRate || 1;
      try { a.currentTime = Math.max(0, (now - start) * rate); } catch { /* ignore */ }
    }
  }

  // Let React (MessageChannel scheduler) and the DOM settle in REAL time
  const settle = () => new Promise(res => {
    const ch = new MessageChannel();
    let n = 0;
    ch.port1.onmessage = () => { if (++n >= 3) res(); else ch.port2.postMessage(0); };
    ch.port2.postMessage(0);
  });

  async function advance(ms) {
    // animations created since the last step started at the CURRENT virtual time, not at the target
    await settle();
    seekAnimations();
    const target = now + ms;
    // fire due timers in order
    for (let guard = 0; guard < 10000; guard++) {
      let nextId = null, next = null;
      for (const [id, t] of timers) if (t.at <= target && (!next || t.at < next.at)) { next = t; nextId = id; }
      if (!next) break;
      now = Math.max(now, next.at);
      if (next.interval) next.at += next.interval; else timers.delete(nextId);
      run(next.fn, next.args);
      await settle();
      seekAnimations(); // transitions started by this timer begin at the timer's time
    }
    now = target;
    // one animation frame per video frame
    const q = rafQueue;
    rafQueue = [];
    for (const r of q) run(r.fn, [now]);
    await settle();
    seekAnimations();
    await new Promise(res => realSetTimeout(res, 0));
  }

  // Smooth scrolling is animated by the compositor in real time -> force instant scrolling
  const stripSmooth = (orig) => function (...args) {
    if (args[0] && typeof args[0] === 'object' && args[0].behavior) args[0] = { ...args[0], behavior: 'auto' };
    return orig.apply(this, args);
  };
  for (const m of ['scrollTo', 'scrollBy', 'scrollIntoView']) {
    if (typeof Element.prototype[m] === 'function') Element.prototype[m] = stripSmooth(Element.prototype[m]);
  }
  window.scrollTo = stripSmooth(window.scrollTo);
  window.scrollBy = stripSmooth(window.scrollBy);
  document.addEventListener('DOMContentLoaded', () => {
    const st = document.createElement('style');
    st.textContent = '*{scroll-behavior:auto!important}::-webkit-scrollbar{display:none!important}';
    document.head.appendChild(st);
  });

  window.__vt = {
    advance,
    seek: seekAnimations,
    settle: async () => { await settle(); seekAnimations(); },
    now: () => now,
    realNow: realPerfNow
  };
};
