import { useEffect } from 'react';

// Touch-like scrolling with the MOUSE (used by the server recorder, which drives the app with a mouse):
// drag the content up/down, release to let it glide (momentum), and when pulled past the top/bottom it
// stretches like a rubber band and springs back – like iOS.
//
// Only mouse pointers are handled; real touch screens keep their native scrolling.
// Everything runs on requestAnimationFrame + performance.now, so the recorder's virtual clock renders it
// frame-exactly.
//
//   scrollRef  – the element with overflow: scroll
//   contentRef – its inner wrapper, which gets the rubber-band translateY
//   key        – re-attach when this changes (e.g. the open chat); null/false disables

const DRAG_THRESHOLD = 4;      // px before a press becomes a drag (smaller moves are still clicks)
const RUBBER = 0.55;           // iOS rubber-band constant
const SPRING_MS = 450;         // spring back duration
const FRICTION = 0.995;        // momentum velocity factor per ms (≈ iOS "normal" deceleration)
const MIN_VELOCITY = 0.02;     // px/ms – stop momentum below this
const NO_DRAG = 'button, input, textarea, select, a, label, [contenteditable="true"], [data-no-drag]';

const rubberBand = (over, dim) => (1 - 1 / ((over * RUBBER) / dim + 1)) * dim;
const rubberBandInverse = (r, dim) => { const q = Math.min(0.99, Math.abs(r) / dim); return (1 / (1 - q) - 1) * dim / RUBBER; };
const easeOutCubic = t => 1 - Math.pow(1 - t, 3);

export default function useDragScroll(scrollRef, contentRef, key = true) {
    useEffect(() => {
        const el = scrollRef.current;
        const content = contentRef.current;
        if (key == null || key === false || !el || !content) return;

        let drag = null;       // { id, startY, startScroll, moved, samples }
        let offset = 0;        // current rubber-band offset (px, + = pulled down at top)
        let anim = 0;          // rAF id
        let suppressClick = false;

        const maxScroll = () => Math.max(0, el.scrollHeight - el.clientHeight);
        const setOffset = (v) => {
            offset = v;
            content.style.transform = v ? `translateY(${v}px)` : '';
        };
        const stop = () => { if (anim) cancelAnimationFrame(anim); anim = 0; };

        // position = desired scrollTop (may be outside 0..max) -> scrollTop + rubber band
        const applyPosition = (pos) => {
            const max = maxScroll();
            const h = el.clientHeight || 1;
            if (pos < 0) { el.scrollTop = 0; setOffset(rubberBand(-pos, h)); }
            else if (pos > max) { el.scrollTop = max; setOffset(-rubberBand(pos - max, h)); }
            else { el.scrollTop = pos; setOffset(0); }
        };

        const springBack = () => {
            stop();
            const from = offset;
            if (!from) return;
            const t0 = performance.now();
            const step = (now) => {
                const t = Math.min(1, (now - t0) / SPRING_MS);
                setOffset(from * (1 - easeOutCubic(t)));
                anim = t < 1 ? requestAnimationFrame(step) : 0;
            };
            anim = requestAnimationFrame(step);
        };

        const momentum = (v0) => {
            stop();
            let v = v0;          // px/ms, + = content scrolls down (scrollTop increases)
            let pos = el.scrollTop;
            let last = performance.now();
            const step = (now) => {
                const dt = Math.min(64, Math.max(1, now - last));
                last = now;
                pos += v * dt;
                v *= Math.pow(FRICTION, dt);
                const max = maxScroll();
                if (pos < 0 || pos > max) {
                    // hit an edge: overshoot a little with the remaining speed, then spring back
                    const edge = pos < 0 ? 0 : max;
                    const over = Math.min(Math.abs(v) * 60, el.clientHeight * 0.15);
                    el.scrollTop = edge;
                    const sign = pos < 0 ? 1 : -1;
                    const t0 = now;
                    const out = (n) => {
                        const t = Math.min(1, (n - t0) / 140);
                        setOffset(sign * over * easeOutCubic(t));
                        if (t < 1) anim = requestAnimationFrame(out); else springBack();
                    };
                    anim = over > 1 ? requestAnimationFrame(out) : 0;
                    return;
                }
                el.scrollTop = pos;
                anim = Math.abs(v) > MIN_VELOCITY ? requestAnimationFrame(step) : 0;
            };
            anim = requestAnimationFrame(step);
        };

        const onDown = (e) => {
            if (e.pointerType !== 'mouse' || e.button !== 0) return;
            if (e.target.closest?.(NO_DRAG)) return;
            stop();
            // continue from where a running spring/momentum currently is
            const over = offset ? rubberBandInverse(offset, el.clientHeight || 1) : 0;
            const startScroll = el.scrollTop + (offset > 0 ? -over : over);
            drag = { id: e.pointerId, startY: e.clientY, startScroll, moved: false, samples: [{ y: e.clientY, t: performance.now() }] };
            e.preventDefault(); // no text selection while dragging
        };

        const onMove = (e) => {
            if (!drag || e.pointerId !== drag.id) return;
            const dy = e.clientY - drag.startY;
            if (!drag.moved) {
                if (Math.abs(dy) < DRAG_THRESHOLD) return;
                drag.moved = true;
                try { el.setPointerCapture(drag.id); } catch { /* ignore */ }
            }
            const now = performance.now();
            drag.samples.push({ y: e.clientY, t: now });
            while (drag.samples.length > 2 && now - drag.samples[0].t > 100) drag.samples.shift();
            applyPosition(drag.startScroll - dy);
        };

        const onUp = (e) => {
            if (!drag || e.pointerId !== drag.id) return;
            const d = drag;
            drag = null;
            try { el.releasePointerCapture(d.id); } catch { /* ignore */ }
            if (!d.moved) return;
            suppressClick = true; // the release of a drag is not a click
            if (offset) { springBack(); return; }
            const now = performance.now();
            const first = d.samples.find(s => now - s.t <= 100) || d.samples[0];
            const lastS = d.samples[d.samples.length - 1];
            const dt = lastS.t - first.t;
            const v = dt > 0 && now - lastS.t < 80 ? -(lastS.y - first.y) / dt : 0;
            if (Math.abs(v) > MIN_VELOCITY * 5) momentum(v);
        };

        const onClick = (e) => {
            if (suppressClick) { suppressClick = false; e.stopPropagation(); e.preventDefault(); }
        };
        const onWheel = () => { stop(); if (offset) setOffset(0); };

        el.addEventListener('pointerdown', onDown);
        el.addEventListener('pointermove', onMove);
        el.addEventListener('pointerup', onUp);
        el.addEventListener('pointercancel', onUp);
        el.addEventListener('click', onClick, true);
        el.addEventListener('wheel', onWheel, { passive: true });
        return () => {
            stop();
            setOffset(0);
            el.removeEventListener('pointerdown', onDown);
            el.removeEventListener('pointermove', onMove);
            el.removeEventListener('pointerup', onUp);
            el.removeEventListener('pointercancel', onUp);
            el.removeEventListener('click', onClick, true);
            el.removeEventListener('wheel', onWheel);
        };
    }, [scrollRef, contentRef, key]);
}
