import { useMemo, useEffect, useState, useRef } from 'react';

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
        markerSize: 20,
        scrollingMarkersEnabled: false,
        scrollingMarkerColor: '#FFFF00',
        scrollingMarkerSize: 15,
        scrollingMarkerCountX: 5,
        scrollingMarkerCountY: 9,
        scrollDirection: 'vertical' // 'horizontal', 'vertical', 'both'
    };

    // Determine background color
    const bgColor = useMemo(() => {
        if (settings.mode === 'green') return settings.greenColor || '#00FF00';
        if (settings.mode === 'blue') return settings.blueColor || '#0000FF';
        return settings.customColor || '#FF00FF';
    }, [settings.mode, settings.greenColor, settings.blueColor, settings.customColor]);

    // Generate Markers Grid
    const markers = useMemo(() => {
        // Unified Logic:
        // We defined a grid of (cols * rows) with a specific spacing.
        // This grid is centered on screen.

        const cols = settings.markerCountX || 5;
        const rows = settings.markerCountY || 9;
        const spacing = settings.markerSpacing || 100;

        const gridW = cols * spacing;
        const gridH = rows * spacing;

        const winW = window.innerWidth;
        const winH = window.innerHeight;

        // Center the grid
        const leftMargin = (winW - gridW) / 2;
        const topMargin = (winH - gridH) / 2;

        // To properly center the dots (which are usually anchor top-left?), 
        // we might want to offset by half-spacing or just assume grid points are intersections.
        // Let's assume standard grid points.
        // The previous logic was: spacing defined full width if not specified? 
        // Now spacing is explicit.

        // Wait, if I have 5 cols and spacing 100, 
        // Does Col 0 start at 0 and Col 4 at 400? Total width 400?
        // Or 5 cells of 100px? Total width 500?
        // Usually visually it's 5 dots.
        // If I center "5 dots with 100px spacing", the width is (cols-1)*spacing.
        // But if I treat them as cells, width is cols*spacing.
        // Let's stick to "grid cells" logic where a marker is centered in a cell?
        // OR marker is at top-left of cell.
        // Previous logic: "spacing" was cell dimensions.
        // Let's use Cell logic. Marker is centered in cell (0.5 * spacing).

        const cellW = spacing;
        const cellH = spacing;

        // Center the "Block of Cells"
        // Grid Width = cols * cellW.
        const gridBlockW = cols * cellW;
        const gridBlockH = rows * cellH;

        const blockLeft = (winW - gridBlockW) / 2;
        const blockTop = (winH - gridBlockH) / 2; // Fixed: was using gridBlockW

        const grid = [];
        if (settings.markersEnabled) {
            for (let y = 0; y < rows; y++) {
                for (let x = 0; x < cols; x++) {
                    grid.push({ x, y });
                }
            }
        }

        return {
            grid,
            cols,
            rows,
            leftMargin: blockLeft,
            topMargin: blockTop,
            cellW,
            cellH
        };
    }, [settings.markersEnabled, settings.markerCountX, settings.markerCountY, settings.markerSpacing]);

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
            // We check if the element still exists before acting, though cleanup is safe
            if (metaThemeColor) metaThemeColor.setAttribute("content", "#000000");
            document.body.style.backgroundColor = "#000000";
            document.documentElement.style.backgroundColor = "#000000";
        };
    }, [bgColor]);

    // --- Scrolling Logic ---
    const [scrollOffset, setScrollOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);

    // Refs for mutable tracking
    const lastPos = useRef({ x: 0, y: 0 });
    const velocity = useRef({ x: 0, y: 0 });
    const lastTimestamp = useRef(0);
    const rafId = useRef(null);

    const handlePointerDown = (e) => {
        if (!settings.scrollingMarkersEnabled) return;

        // Stop any active momentum
        if (rafId.current) {
            cancelAnimationFrame(rafId.current);
            rafId.current = null;
        }

        setIsDragging(true);
        lastPos.current = { x: e.clientX, y: e.clientY };
        velocity.current = { x: 0, y: 0 };
        lastTimestamp.current = performance.now();

        e.currentTarget.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e) => {
        if (!isDragging || !settings.scrollingMarkersEnabled) return;

        const now = performance.now();
        const dt = now - lastTimestamp.current;
        lastTimestamp.current = now;

        const dx = e.clientX - lastPos.current.x;
        const dy = e.clientY - lastPos.current.y;
        lastPos.current = { x: e.clientX, y: e.clientY };

        let moveX = 0;
        let moveY = 0;

        const dir = settings.scrollDirection || 'vertical';
        if (dir === 'horizontal' || dir === 'both') moveX = dx;
        if (dir === 'vertical' || dir === 'both') moveY = dy;

        // Calculate velocity (pixels per ms)
        // Simple moving average or just instantaneous could work. 
        // For smoothness, let's just take instantaneous but maybe clamp it?
        if (dt > 0) {
            velocity.current = {
                x: moveX / dt,
                y: moveY / dt
            };
        }

        setScrollOffset(prev => ({
            x: prev.x + moveX,
            y: prev.y + moveY
        }));
    };

    const handlePointerUp = (e) => {
        setIsDragging(false);
        e.currentTarget.releasePointerCapture(e.pointerId);

        if (settings.scrollingMomentum) {
            startMomentum();
        }
    };

    const startMomentum = () => {
        if (rafId.current) cancelAnimationFrame(rafId.current);

        let lastTime = performance.now();
        const friction = 0.95; // Decay factor
        const stopThreshold = 0.05; // px/ms

        const momentumLoop = (time) => {
            const dt = time - lastTime;
            lastTime = time;

            // If delta time is weirdly high (tab switch), clamp it to avoid huge jumps
            const safeDt = Math.min(dt, 50);

            let velX = velocity.current.x;
            let velY = velocity.current.y;

            // Apply friction
            velX *= friction;
            velY *= friction;

            velocity.current = { x: velX, y: velY };

            // Check if we stopped
            if (Math.abs(velX) < stopThreshold && Math.abs(velY) < stopThreshold) {
                rafId.current = null;
                return; // Stop loop
            }

            const dir = settings.scrollDirection || 'vertical';
            let moveX = 0;
            let moveY = 0;
            if (dir === 'horizontal' || dir === 'both') moveX = velX * safeDt;
            if (dir === 'vertical' || dir === 'both') moveY = velY * safeDt;

            setScrollOffset(prev => ({
                x: prev.x + moveX,
                y: prev.y + moveY
            }));

            rafId.current = requestAnimationFrame(momentumLoop);
        };

        rafId.current = requestAnimationFrame(momentumLoop);
    };

    // Scrolling Markers Render Generation
    // New Logic: Tiling the defined pattern (Cols x Rows x Spacing)
    const scrollingGrid = useMemo(() => {
        if (!settings.scrollingMarkersEnabled) return null;

        const cols = settings.scrollingMarkerCountX || 5;
        const rows = settings.scrollingMarkerCountY || 9;
        const spacing = settings.scrollingMarkerSpacing || 100;

        const cellW = spacing;
        const cellH = spacing;

        const patternW = cols * cellW;
        const patternH = rows * cellH;

        const winW = window.innerWidth;
        const winH = window.innerHeight;

        // Center alignment logic (same as static)
        // Position of the pattern's (0,0) relative to screen (0,0) before scroll
        const startX = (winW - patternW) / 2;
        const startY = (winH - patternH) / 2;

        const renderItems = [];
        const safeMod = (n, m) => ((n % m) + m) % m;

        // Visual Offset of the pattern due to scroll
        // The pattern repeats every patternW / patternH
        // But actually, we want the *cells* to feel like an infinite grid?
        // Or do we want the *Block* to repeat?
        // "Tracking Points" usually implies a field.
        // If the user defines "5x9", maybe they want that specific block?
        // If I scroll, do I see another block?
        // Let's assume infinite FIELD of points defined by spacing.
        // BUT the user sets Count.
        // If Count is irrelevant for scrolling (infinite field), why have it?
        // Maybe Count defines the "Density" in some way? Or "Pattern Size"?
        // Actually, if spacing is fixed, Count just defines effective area.
        // If I want "Infinite Scroll", I probably want an infinite field.
        // However, if the user explicitly sets "Count", maybe they want gaps between blocks?
        // Let's assume standard "Infinite Grid" where Count is ignored for tiling?
        // NO, user said "Position and Count parallel".
        // Likely: They want to define a grid (e.g. 5x5) and have that grid repeat?
        // OR: They just want to control the "View" of the grid.
        // Given previous context "VFX Tracking Markers", usually it's a field of dots.
        // If I set Count=20, I get a dense field?
        // If I set Spacing=20, I get dense field.
        // Let's stick to: The "Pattern" is Cols x Rows.
        // We Tile this Pattern.
        // If Cols*Spacing < Screen, we definitely need tiling.
        // If we Tile, we essentially have an infinite grid of dots if there are no gaps between tiles.
        // (Cols * CellW) width tile.
        // If we just repeat it, it looks like a continuous grid.

        // So, logic:
        // Pattern Width = cols * cellW
        // Pattern Height = rows * cellH
        // We repeat this pattern infinitely.
        // Since the pattern is just a filled grid of uniform cells, 
        // Repeating it seamlessly creates an infinite uniform grid.

        // So effectively: We just need to cover the screen with cells of size `spacing`.
        // The `cols` and `rows` settings effectively become redundant for *rendering* structure 
        // IF the pattern is uniform.
        // BUT: Maybe the user wants "Alternating" or "Grouped" markers?
        // For now, let's assume Uniform. 
        // Use `spacing` for cell size.
        // Use `cols/rows` to determine... well, nothing if it's just uniform?
        // Wait, user explicitly asked for "Count" and "Spacing" sliders.
        // If I use Spacing, I define density.
        // If I use Count... maybe I define the *bounds* of the grid?
        // If I assume "Scrolling" means "move the grid", but the grid is finite?
        // User asked "es soll nicht die Anzahl der Tracking Punkte verändert werden".
        // If I drag, I expect to see points move.
        // If grid is finite (5x5), and I drag, it moves off screen?
        // "Infinite scrolling" usually means it wraps.
        // Only way to wrap a 5x5 grid seamlessly is if we repeat it.
        // If we repeat 5x5 grid with no gaps, it's identical to infinite grid.

        // OK, I will implement it as an infinite grid where `spacing` dictates density.
        // And `cols`/`rows`... potentially defines the 'wrapping period'?
        // Actually, if I just use `spacing` to render an infinite grid, `cols/rows` inputs become fake?
        // User might be confused if `cols` slider does nothing.
        // But if `cols` * `spacing` = `width`, then changing `cols` changes width.
        // If I tile the width, changing `cols` changes the repetition frequency.
        // If the grid is uniform dots, repetition frequency is invisible unless dots are unique.
        // Dots are identical.
        // So `cols` slider effectively does nothing visible if grid is uniform?
        // That might be the confusion.
        // Unless... the user uses Count relative to screen width? (Layout Mode: Count).
        // The user wanted to MERGE them.
        // "Count" usually implies "Fit N items in screen".
        // "Spacing" implies "Fit items with X px gap".
        // These are mathematically inversely related given a fixed screen width.
        // Fixed Screen Width = Count * Spacing.
        // You cannot set both independently for a FIXED width.
        // User: "The two modes should not be exclusive... parallel adjustment... create a layout".
        // "Should not change number of points when spacing is changed".
        // This is the key.
        // If I change spacing, and count is fixed -> Total Width changes.
        // So the grid grows/shrinks.
        // This is perfectly valid for "Static" (centered grid).
        // For "Scrolling": The "Tile" grows/shrinks.
        // If the Tile is uniform dots, it again looks like just density changing.
        // Visual result:
        // Static: Grid expands/contracts. Count stays same.
        // Scrolling: Grid expands/contracts.
        // This seems to satisfy the requirement "Count and Spacing parallel".
        // So I will implement exactly that.

        // Tiling Logic for Infinite Moving Grid:
        // We need to render enough markers to cover the Viewport.
        // The Density is determined by `spacing`.
        // The Phase is determined by `scrollOffset`.
        // The `cols/rows` settings are actually... irrelevant for the *appearance* of an infinite uniform grid?
        // Except maybe for centering logic?
        // If I align the "Center of the Grid" to the screen center.
        // Grid Center = (Cols*Spacing)/2.
        // If I change Cols, the center shifts? 
        // Actually, let's just render an infinite grid rooted at Center Screen.
        // Or rooted at top-left?
        // Static grid is Centered.
        // Scrolling grid should align with Static grid at (0,0).
        // So Scrolling Grid origin = (WinW - Cols*Spacing)/2.
        // This means `Cols` SETTING affects the ALIGNMENT of the infinite grid.
        // This makes `Cols` relevant!

        // Logic:
        // 1. Calculate Origin (startX, startY) based on Cols, Spacing, WinSize.
        // 2. Render infinite grid cells starting from that Origin + ScrollOffset.

        // OriginX = (WinW - Cols*Spacing)/2
        // OriginY = (WinH - Rows*Spacing)/2

        const originX = (winW - (cols * spacing)) / 2;
        const originY = (winH - (rows * spacing)) / 2;

        // Effective Phase = Origin + Scroll
        const effectiveX = originX + scrollOffset.x;
        const effectiveY = originY + scrollOffset.y;

        // We need to cover 0 to WinW.
        // We want to draw markers at: effectiveX + k*spacing.
        // k can be any integer.
        // We need to find range of k such that marker is visible.
        // 0 <= effectiveX + k*spacing <= WinW + spacing
        // -effectiveX <= k*spacing <= WinW + spacing - effectiveX
        // -effectiveX/spacing <= k <= ...

        const startKx = Math.floor(-effectiveX / spacing) - 1;
        const endKx = Math.ceil((winW - effectiveX) / spacing) + 1;

        const startKy = Math.floor(-effectiveY / spacing) - 1;
        const endKy = Math.ceil((winH - effectiveY) / spacing) + 1;

        for (let y = startKy; y <= endKy; y++) {
            for (let x = startKx; x <= endKx; x++) {
                renderItems.push({
                    left: effectiveX + (x * spacing),
                    top: effectiveY + (y * spacing)
                });
            }
        }

        return renderItems;

    }, [settings.scrollingMarkersEnabled, settings.scrollingMarkerCountX, settings.scrollingMarkerCountY, settings.scrollingMarkerSpacing, scrollOffset, settings.markerCountX, settings.markerCountY, settings.markerSpacing]); // Depend on main settings as fallback default logic

    // Style props for Static Grid
    const staticGridStyle = (markers && markers.cellW) ? {
        display: 'grid',
        position: 'absolute',
        top: markers.topMargin,
        left: markers.leftMargin,
        width: (markers.cols * markers.cellW),
        height: (markers.rows * markers.cellH),
        gridTemplateColumns: `repeat(${markers.cols}, ${markers.cellW}px)`,
        gridTemplateRows: `repeat(${markers.rows}, ${markers.cellH}px)`,
        zIndex: 1,
        pointerEvents: 'none'
    } : {}; // Fallback


    return (
        <div
            style={{
                width: '100vw',
                height: '100dvh', // dynamic viewport height
                backgroundColor: bgColor,
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                touchAction: 'none', // Prevent browser scrolling
                userSelect: 'none',
                cursor: settings.scrollingMarkersEnabled ? (isDragging ? 'grabbing' : 'grab') : 'default'
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp} // Handle interruption
        >
            {/* Layer 1: Static Markers */}
            {settings.markersEnabled && markers.grid && (
                <div style={staticGridStyle}>
                    {markers.grid.map((pos, idx) => (
                        <div key={'static-' + idx} style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '0px solid rgba(0,0,0,0.05)'
                        }}>
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

            {/* Layer 2: Scrolling Markers */}
            {settings.scrollingMarkersEnabled && scrollingGrid && (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    zIndex: 2, // Higher z-index? or same?
                    pointerEvents: 'none' // Clicks/drags go to container
                }}>
                    {scrollingGrid.map((pos, idx) => (
                        <div key={'scroll-' + idx} style={{
                            position: 'absolute',
                            left: pos.left,
                            top: pos.top,
                            transform: 'translate(-50%, -50%)', // Center the marker on its coordinate
                        }}>
                            <svg
                                width={settings.scrollingMarkerSize || 15}
                                height={settings.scrollingMarkerSize || 15}
                                viewBox="0 0 24 24"
                                fill={settings.scrollingMarkerColor || 'yellow'}
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
