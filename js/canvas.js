// ===== canvas.js — Drawing engine with real-time stroke sync =====
// Coordinates are normalized (0-1 range) before sending, so drawings map
// correctly regardless of each player's screen size.

const DrawCanvas = (() => {
  let canvas, ctx;
  let isDrawing = false;
  let currentColor = '#1a1a22';
  let currentWidth = 4;
  let isEraser = false;
  let isFillMode = false;
  let lastX = 0, lastY = 0;
  let canDraw = false; // only the active drawer can draw
  let onLocalStroke = null; // callback(strokeData) to send over the wire
  let onLocalFill = null;   // callback(fillData) to send over the wire

  // History for undo. Each entry is either a stroke gesture
  // { segments: [...] } or a fill action { fill: { x, y, color } }, kept
  // in the order they happened so redraw/undo replays everything correctly.
  let strokeHistory = [];
  let currentGesture = null;
  const MAX_HISTORY = 150;   // cap so long sessions don't grow memory unbounded — raised from 60 now that a single continuous gesture is one entry regardless of point count (see renderRemoteStroke's chaining), so this cap now roughly limits "number of distinct pen-lifts/fills", not "number of segments"

  function redrawAll() {
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    strokeHistory.forEach(entry => {
      if (entry.fill) {
        floodFillRaw(entry.fill.x, entry.fill.y, entry.fill.color);
      } else {
        entry.segments.forEach(s => drawSegmentRaw(s.x1, s.y1, s.x2, s.y2, s.color, s.width, s.erase));
      }
    });
  }

  function drawSegmentRaw(x1, y1, x2, y2, color, width, erase) {
    const rect = canvas.getBoundingClientRect();
    ctx.save();
    ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1 * rect.width, y1 * rect.height);
    ctx.lineTo(x2 * rect.width, y2 * rect.height);
    ctx.stroke();
    ctx.restore();
  }

  function hexToRgba(hex) {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return [r, g, b, 255];
  }

  // Classic 4-directional flood fill on the canvas's raw pixel buffer.
  // x,y come in as normalized (0-1) coordinates, same as strokes, so fills
  // sync and replay identically regardless of each player's canvas size.
  //
  // TOLERANCE-BASED MATCHING (not exact-color): canvas strokes are
  // anti-aliased — the pixels right along a drawn outline are a partial
  // blend between the stroke color and the background, not a pure exact
  // match to either. An exact-equality flood fill (old behavior) treats
  // every one of those semi-transparent edge pixels as "not the
  // background", which sounds safe but actually works AGAINST
  // containment: on a thin or slightly-open outline (any 1-2px gap from
  // a stroke that didn't quite close, common with the hand-authored
  // multi-point sketches in js/drawings.js, or just a fast finger-drawn
  // line on a real player's screen), the fill has no "wall" of matching
  // background pixels to stop at right at that gap — it finds one
  // non-matching pixel, stops expanding through the strict boundary
  // test in the wrong place, or worse, the anti-aliased ring right
  // outside a THIN outline still counts as "background" (since it's
  // barely tinted) and the flood walks straight through it, spilling
  // color across the entire canvas. This is the exact "fill leaks
  // everywhere" bug.
  //
  // The fix used by every real paint-bucket tool: treat any pixel within
  // a small color-distance TOLERANCE of the start pixel as fillable
  // (handles anti-aliased near-background pixels near a gap the same
  // way exact background is handled), and separately treat any pixel
  // that's reasonably close in color to the FILL color itself as "already
  // there" so re-flooding a spot doesn't infinite-loop. Distance is
  // computed once per pixel with cheap integer math (no sqrt needed
  // since we're only comparing against a squared threshold).
  const FILL_TOLERANCE = 60; // squared-distance-free per-channel-ish budget; see colorDist below
  const FILL_TOLERANCE_SQ = FILL_TOLERANCE * FILL_TOLERANCE;

  function floodFillRaw(nx, ny, colorHex) {
    try {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.round(rect.width * dpr);
      const h = Math.round(rect.height * dpr);
      if (w === 0 || h === 0 || w !== canvas.width || h !== canvas.height) {
        // Canvas backing size doesn't match what we're about to read —
        // this happens for a frame or two right around a resize. Bail
        // rather than read/write pixels at the wrong dimensions, which
        // would fill the wrong region (or silently no-op, which is
        // exactly the "fill does nothing" symptom).
        return;
      }

      const startX = Math.floor(nx * w);
      const startY = Math.floor(ny * h);
      if (startX < 0 || startY < 0 || startX >= w || startY >= h) return;

      const imgData = ctx.getImageData(0, 0, w, h);
      const data = imgData.data;
      const [fr, fg, fb, fa] = hexToRgba(colorHex);

      const startIdx = (startY * w + startX) * 4;
      const startR = data[startIdx], startG = data[startIdx + 1], startB = data[startIdx + 2], startA = data[startIdx + 3];

      // Starting pixel is already close enough to the fill color —
      // nothing meaningful to do (also prevents re-flooding an area
      // that was already filled with this exact tool a moment ago).
      const startDist = colorDistSq(startR, startG, startB, startA, fr, fg, fb, fa);
      if (startDist <= FILL_TOLERANCE_SQ) return;

      // "Fillable" = close in color to the pixel we started ON (the
      // background/interior region), same tolerance-based test used
      // throughout. This is what makes a semi-transparent anti-aliased
      // edge pixel correctly read as "still basically background — keep
      // going" right up until it's actually close to the drawn line's
      // real color, instead of stopping (or leaking through) at the
      // first not-100%-identical pixel.
      const fillable = (idx) =>
        colorDistSq(data[idx], data[idx + 1], data[idx + 2], data[idx + 3], startR, startG, startB, startA) <= FILL_TOLERANCE_SQ;

      // Iterative stack-based fill (recursion would blow the call stack on
      // large canvases). Scanline variant keeps this fast enough for a
      // typical phone-sized drawing area.
      const stack = [[startX, startY]];
      const visited = new Uint8Array(w * h); // avoid re-queuing/re-scanning the same row segment from multiple directions
      while (stack.length) {
        const [x, y] = stack.pop();
        if (visited[y * w + x]) continue;

        let leftX = x;
        let idx = (y * w + leftX) * 4;
        while (leftX >= 0 && fillable(idx) && !visited[y * w + leftX]) { leftX--; idx -= 4; }
        leftX++;

        let rightX = x;
        idx = (y * w + rightX) * 4;
        while (rightX < w && fillable(idx) && !visited[y * w + rightX]) { rightX++; idx += 4; }
        rightX--;

        for (let i = leftX; i <= rightX; i++) {
          const fillIdx = (y * w + i) * 4;
          data[fillIdx] = fr; data[fillIdx + 1] = fg; data[fillIdx + 2] = fb; data[fillIdx + 3] = fa;
          visited[y * w + i] = 1;

          if (y > 0) {
            const upIdx = ((y - 1) * w + i) * 4;
            if (!visited[(y - 1) * w + i] && fillable(upIdx)) stack.push([i, y - 1]);
          }
          if (y < h - 1) {
            const downIdx = ((y + 1) * w + i) * 4;
            if (!visited[(y + 1) * w + i] && fillable(downIdx)) stack.push([i, y + 1]);
          }
        }
      }

      ctx.putImageData(imgData, 0, 0);
    } catch (err) {
      console.warn('[DrawCanvas] flood fill failed:', err);
    }
  }

  // Squared Euclidean-ish distance across R/G/B/A. Squared (no sqrt) since
  // it's only ever compared against a squared threshold — cheap enough to
  // call per-pixel across a whole canvas scan. Alpha is weighted in too so
  // a fully-transparent background pixel and a stroke's opaque edge don't
  // read as "close" just because their RGB happens to be similar.
  function colorDistSq(r1, g1, b1, a1, r2, g2, b2, a2) {
    const dr = r1 - r2, dg = g1 - g2, db = b1 - b2, da = a1 - a2;
    return dr * dr + dg * dg + db * db + da * da;
  }

  function resizeCanvas() {
    if (!canvas) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return; // not laid out yet, skip

    const dpr = window.devicePixelRatio || 1;
    const targetWidth = Math.round(rect.width * dpr);
    const targetHeight = Math.round(rect.height * dpr);

    // Setting canvas.width/height always clears the canvas, even if the
    // value doesn't actually change. Skip the whole resize if the size
    // is unchanged — this was silently wiping strokes that arrived from
    // the remote peer right around a redundant resize (e.g. the
    // requestAnimationFrame follow-up call in init()).
    if (canvas.width === targetWidth && canvas.height === targetHeight) return;

    canvas.width = targetWidth;
    canvas.height = targetHeight;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';

    // Reset transform before rescaling — otherwise repeated resizes
    // (e.g. keyboard open/close, orientation change) compound the scale
    // and touch coordinates stop lining up with what's drawn.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Re-render from the stored history at the new size, rather than
    // stretching old pixels — this also makes fills re-flow correctly
    // after a resize instead of leaving stale colored regions.
    redrawAll();
  }

  function getPointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    const point = e.touches ? e.touches[0] : e;
    const x = (point.clientX - rect.left) / rect.width;
    const y = (point.clientY - rect.top) / rect.height;
    return { x, y };
  }

  function handleStart(e) {
    if (!canDraw) return;
    e.preventDefault();
    const pos = getPointerPos(e);

    if (isFillMode) {
      const fillData = { x: pos.x, y: pos.y, color: currentColor };
      floodFillRaw(fillData.x, fillData.y, fillData.color);
      strokeHistory.push({ fill: fillData });
      if (strokeHistory.length > MAX_HISTORY) strokeHistory.shift();
      onLocalFill && onLocalFill(fillData);
      return;
    }

    isDrawing = true;
    lastX = pos.x;
    lastY = pos.y;

    currentGesture = { segments: [] };

    // Send a tiny dot for single taps
    const stroke = { x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y, color: currentColor, width: currentWidth, erase: isEraser };
    drawSegmentRaw(stroke.x1, stroke.y1, stroke.x2, stroke.y2, stroke.color, stroke.width, stroke.erase);
    currentGesture.segments.push(stroke);
    onLocalStroke && onLocalStroke(stroke);
  }

  function handleMove(e) {
    if (!canDraw || !isDrawing || isFillMode) return;
    e.preventDefault();
    const pos = getPointerPos(e);
    const stroke = { x1: lastX, y1: lastY, x2: pos.x, y2: pos.y, color: currentColor, width: currentWidth, erase: isEraser };
    drawSegmentRaw(stroke.x1, stroke.y1, stroke.x2, stroke.y2, stroke.color, stroke.width, stroke.erase);
    currentGesture && currentGesture.segments.push(stroke);
    onLocalStroke && onLocalStroke(stroke);
    lastX = pos.x;
    lastY = pos.y;
  }

  function handleEnd() {
    isDrawing = false;
    if (currentGesture && currentGesture.segments.length > 0) {
      strokeHistory.push(currentGesture);
      if (strokeHistory.length > MAX_HISTORY) strokeHistory.shift();
    }
    currentGesture = null;
  }

  let initialized = false; // guards against stacking duplicate listeners if init() is called again (e.g. Play Again rematch reusing the same <canvas>)

  return {
    init(canvasEl, strokeCallback, fillCallback) {
      canvas = canvasEl;
      ctx = canvas.getContext('2d');
      onLocalStroke = strokeCallback;
      onLocalFill = fillCallback;

      // Canvas's parent might not be laid out yet (e.g. screen still
      // display:none at this exact moment) — resize now and again on the
      // next frame once layout has settled, so we never end up scaled
      // against a 0×0 box. resizeCanvas() itself now no-ops if the size
      // hasn't actually changed, so this can't wipe existing strokes.
      resizeCanvas();
      requestAnimationFrame(resizeCanvas);

      // Everything below (ResizeObserver, window resize listener, pointer
      // listeners) only needs to be wired ONCE per <canvas> element — a
      // rematch (Play Again) calls init() again on the very same element
      // with fresh strokeCallback/fillCallback closures (captured above),
      // but re-running addEventListener/observe here would stack a second
      // copy alongside the first, so every future stroke would draw twice,
      // fills would double-toggle, etc. Guard so only the first init()
      // call for this page load actually attaches listeners.
      if (initialized) return;
      initialized = true;

      // .canvas-wrap's height comes from a flex:1 parent (.game-panel-mid)
      // that settles AFTER its siblings' content is known (word-banner
      // text wrap, hint tiles populating a moment later, chat log height,
      // etc). A one-shot + rAF resize can sample the size before that
      // flex redistribution finishes and lock the backing store at a
      // too-short height — the CSS box still stretches to fill the real
      // space, so drawing above the locked height shows fine and
      // everything below it reads as blank (empty, unbacked canvas
      // region). ResizeObserver watches the actual box .canvas-wrap ends
      // up at, however many reflows it takes to get there, and re-syncs
      // automatically — unlike window's 'resize' event, which only fires
      // for viewport-level changes, not internal flex reflows.
      if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(() => resizeCanvas());
        ro.observe(canvas.parentElement);
      }

      // Debounce window resize (mobile keyboard open/close fires this a
      // lot) so we don't thrash the canvas mid-typing. Kept alongside
      // ResizeObserver as a fallback for viewport-level changes (e.g.
      // browsers where ResizeObserver support is missing).
      let resizeTimer = null;
      window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(resizeCanvas, 200);
      });

      canvas.addEventListener('mousedown', handleStart);
      canvas.addEventListener('mousemove', handleMove);
      canvas.addEventListener('mouseup', handleEnd);
      canvas.addEventListener('mouseleave', handleEnd);

      canvas.addEventListener('touchstart', handleStart, { passive: false });
      canvas.addEventListener('touchmove', handleMove, { passive: false });
      canvas.addEventListener('touchend', handleEnd);
      canvas.addEventListener('touchcancel', handleEnd);
    },

    // Called when a stroke arrives from the remote peer. Pushed into the
    // same strokeHistory the drawer's own strokes use — NOT just painted
    // directly — because resizeCanvas() repaints entirely FROM
    // strokeHistory whenever the canvas's backing size changes (keyboard
    // open/close, a hint tile row appearing/disappearing, orientation
    // changes, etc). A guesser's canvas resizes just as often as a
    // drawer's does; painting remote strokes without recording them
    // meant every one of those resizes wiped the guesser's screen back
    // to blank, discarding everything the drawer had drawn so far.
    //
    // Consecutive segments are merged into the SAME history entry when
    // they visibly chain together (this segment's start ≈ the previous
    // segment's end, same color/width/erase) — exactly mirroring how the
    // local drawer's own handleMove() accumulates one pointer-drag into
    // one currentGesture before pushing a single history entry in
    // handleEnd(). Without this, a single continuous pen-drag (or the
    // bot's multi-point sketch lines) would arrive as dozens of
    // one-segment history entries instead of one gesture, blowing
    // through MAX_HISTORY many times faster and dropping the EARLIEST
    // parts of the drawing off the front on every resize.
    renderRemoteStroke(stroke) {
      drawSegmentRaw(stroke.x1, stroke.y1, stroke.x2, stroke.y2, stroke.color, stroke.width, stroke.erase);

      const last = strokeHistory[strokeHistory.length - 1];
      const lastSeg = last && !last.fill ? last.segments[last.segments.length - 1] : null;
      const chains = lastSeg
        && Math.abs(lastSeg.x2 - stroke.x1) < 0.001 && Math.abs(lastSeg.y2 - stroke.y1) < 0.001
        && lastSeg.color === stroke.color && lastSeg.width === stroke.width && !!lastSeg.erase === !!stroke.erase;

      if (chains) {
        last.segments.push(stroke);
      } else {
        strokeHistory.push({ segments: [stroke] });
        if (strokeHistory.length > MAX_HISTORY) strokeHistory.shift();
      }
    },

    // Called when a fill action arrives from the remote peer. Same
    // reasoning as renderRemoteStroke above — must be recorded so a
    // mid-round resize's redrawAll() can reproduce it.
    renderRemoteFill(fillData) {
      floodFillRaw(fillData.x, fillData.y, fillData.color);
      strokeHistory.push({ fill: fillData });
      if (strokeHistory.length > MAX_HISTORY) strokeHistory.shift();
    },

    // Drawer-side undo: pop the last entry (stroke gesture OR fill) and
    // repaint locally from the remaining history.
    //
    // Previously this returned the full remaining strokeHistory array so
    // app.js could send the WHOLE thing to the guesser as the 'undo'
    // message's payload every single time. That works, but on a
    // detailed drawing near MAX_HISTORY (150 entries, each a full
    // stroke gesture's worth of segments) it means every undo tap sent
    // a payload that only grows as the drawing gets more complex —
    // exactly when a slower connection can least afford it, and right
    // when someone's actively trying to fix a mistake and wants it to
    // feel instant. Undo only ever removes ONE entry, so there's no
    // reason to resend the other 149 unchanged ones every time — see
    // undoLocal() below, which the guesser now uses instead.
    undo() {
      strokeHistory.pop();
      redrawAll();
      return strokeHistory.slice();
    },

    // Guesser-side: mirrors the drawer's own undo() — pop the last
    // history entry and repaint from what's left — instead of receiving
    // and replacing the entire history array over the wire. This is
    // safe as long as both sides' strokeHistory arrays are already in
    // sync (true for the normal case: every stroke/fill the drawer made
    // was already relayed and recorded via renderRemoteStroke/
    // renderRemoteFill as it happened). The network message itself
    // carries no payload now — see the 'undo' case in app.js.
    undoLocal() {
      strokeHistory.pop();
      redrawAll();
    },

    // Guesser-side fallback: receives an explicit history array and
    // replaces strokeHistory wholesale. Kept for cases where an exact
    // resync is genuinely needed (e.g. a reconnect mid-round where the
    // guesser's local history can't be trusted to already match the
    // drawer's) rather than the common-case single-entry undo, which
    // now goes through the lighter undoLocal() above instead.
    replay(history) {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      strokeHistory = history.slice();
      redrawAll();
    },

    clear() {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      strokeHistory = [];
      currentGesture = null;
    },

    hasHistory() { return strokeHistory.length > 0; },

    // Called at the start of every turn (both drawer and guesser side).
    // Fill/eraser mode used to persist silently across turns in this
    // shared module — a drawer who left fill ON last time they drew
    // would find their next click on "Fill" turning it OFF (toggling
    // off a `true` that the UI never showed as active), because the
    // button's .active class gets reset on turn start but this internal
    // boolean didn't. Resetting here keeps the internal state and the
    // toolbar's visual state starting from the same clean baseline every
    // turn, same as color/width already do implicitly via setColor().
    setCanDraw(value) {
      canDraw = value;
      isFillMode = false;
      isEraser = false;
    },
    setColor(color) { currentColor = color; isEraser = false; isFillMode = false; },
    setWidth(width) { currentWidth = width; },
    setEraser(value) { isEraser = value; if (value) isFillMode = false; },
    setFillMode(value) { isFillMode = value; if (value) isEraser = false; },
    isEraser() { return isEraser; },
    isFillMode() { return isFillMode; },
    getColor() { return currentColor; },
  };
})();
